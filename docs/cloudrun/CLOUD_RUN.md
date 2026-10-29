# ทางเลือก: ย้าย API ไป Cloud Run

> ตอนนี้ deploy ด้วย Render ตาม [../DEPLOY.md](../DEPLOY.md) ไฟล์นี้เก็บไว้เผื่อย้ายภายหลัง
> ถ้าจะใช้ ให้ย้าย `deploy-api.yml` ในโฟลเดอร์นี้ไปแทนตัวที่อยู่ใน `.github/workflows/`

ภาพรวม production:

```
ผู้ใช้ ──> Vercel (Next.js, apps/web)
             │  rewrite /api/*  (same-origin → refresh cookie เป็น first-party)
             ▼
          Cloud Run service  repright-api   (asia-southeast1)
          Cloud Run job      repright-migrate  (รันก่อน deploy ทุกครั้ง)
             │
             ▼
          Neon Postgres  (aws-ap-southeast-1, Singapore)
```

Flow ของ CI/CD:

```
push / PR ──> ci.yml (lint, sqlc diff, test + postgres, docker build)
push main ──> ci.yml ผ่าน ──> deploy-api.yml
                               1. build image → Artifact Registry (tag = commit SHA)
                               2. Cloud Run job: api migrate up  (ถ้าพัง หยุด ไม่ deploy)
                               3. Cloud Run service: deploy image ใหม่
web ───────> Vercel Git integration (preview ทุก PR, production เมื่อ merge main)
```

ทำตามลำดับด้านล่าง ข้ามขั้นไม่ได้เพราะขั้นหลังใช้ค่าจากขั้นก่อน
จดค่าที่ได้แต่ละขั้นไว้ในตาราง "ค่าที่ต้องจด" ท้ายไฟล์

---

## 1. GitHub: สิทธิ์และ branch protection

1. ให้บัญชีที่ใช้ push มีสิทธิ์ **Write** ขึ้นไปบน `thakornt/rep-right`
   - บัญชีอื่นต้องได้รับเชิญที่ Settings → Collaborators
   - หรือเพิ่ม SSH key ให้บัญชี `thakornt` แล้วใส่ `Host github.com` ใน `~/.ssh/config`
2. push `main` ครั้งแรก แล้วดูให้ workflow **ci** เขียวที่แท็บ Actions
3. Settings → Branches → Add rule สำหรับ `main`
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass → เลือก `api`
4. Settings → Environments → New environment ชื่อ `production`
   - (ทางเลือก) Required reviewers = ตัวเอง ถ้าอยากกดอนุมัติก่อนทุก deploy
   - (ทางเลือก) Deployment branches = `main` เท่านั้น

## 2. Neon: ฐานข้อมูล

1. สมัครที่ neon.tech → Create project
   - Name: `repright`
   - Postgres: **17** (ให้ตรงกับ docker compose)
   - Region: **AWS Asia Pacific (Singapore)**
2. Database: `repright`, Role: `repright` (หรือใช้ค่า default ก็ได้)
3. ที่ Dashboard → Connect จะได้ connection string 2 แบบ
   - **Pooled** (host มีคำว่า `-pooler`): ใช้กับ API → secret `database-url`
   - **Direct** (ไม่มี `-pooler`): ใช้กับ migration → secret `database-url-direct`
   - ทั้งสองต้องลงท้ายด้วย `?sslmode=require`
4. Settings → Compute: ใน free tier จะ autosuspend เมื่อไม่มีการใช้งาน
   - request แรกหลัง suspend จะช้าขึ้นราว 0.5-1 วินาที ถือว่ารับได้ในช่วงแรก

> การ migrate ต้องใช้ direct connection เพราะ goose ใช้ session-level state ที่ไม่ควรผ่าน PgBouncer

## 3. Google Cloud: โปรเจกต์และ Cloud Run

ติดตั้ง `gcloud` แล้ว `gcloud auth login`

ตั้งตัวแปรใน shell ก่อน แล้วรันคำสั่งที่เหลือของขั้นนี้ใน shell เดียวกัน:

```bash
export PROJECT_ID=repright-prod        # ต้อง unique ทั่วโลก ถ้าซ้ำให้เติมเลขต่อท้าย
export REGION=asia-southeast1
export GH_REPO=thakornt/rep-right
```

### 3.1 สร้างโปรเจกต์และผูก billing

```bash
gcloud projects create $PROJECT_ID
gcloud config set project $PROJECT_ID
```

ไปที่ Console → Billing → Link a billing account
- Cloud Run ต้องมี billing แม้จะอยู่ใน free tier
- ตั้ง **Budget alert** ที่ $5 ด้วย: Billing → Budgets & alerts

### 3.2 เปิด API ที่ต้องใช้

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com iamcredentials.googleapis.com \
  iam.googleapis.com sts.googleapis.com cloudresourcemanager.googleapis.com
```

### 3.3 Artifact Registry (เก็บ Docker image)

```bash
gcloud artifacts repositories create repright \
  --repository-format=docker --location=$REGION

# ลบ image เก่าอัตโนมัติ เก็บไว้แค่ 10 ตัวล่าสุด กันค่า storage บาน
cat > /tmp/ar-cleanup.json <<'EOF'
[{"name":"keep-10","action":{"type":"Keep"},"mostRecentVersions":{"keepCount":10}},
 {"name":"delete-old","action":{"type":"Delete"},"condition":{"olderThan":"2592000s"}}]
EOF
gcloud artifacts repositories set-cleanup-policies repright \
  --location=$REGION --policy=/tmp/ar-cleanup.json
```

### 3.4 Service accounts

มี 2 ตัว:
- `api-runtime` คือ identity ที่ container ใช้ตอนรัน อ่านได้แค่ secret
- `gh-deployer` คือตัวที่ GitHub Actions ใช้ deploy

```bash
gcloud iam service-accounts create api-runtime --display-name="rep-right API runtime"
gcloud iam service-accounts create gh-deployer --display-name="GitHub Actions deployer"

export RUNTIME_SA=api-runtime@$PROJECT_ID.iam.gserviceaccount.com
export DEPLOYER_SA=gh-deployer@$PROJECT_ID.iam.gserviceaccount.com

# deployer: deploy Cloud Run, push image, และ "act as" runtime SA ได้
for role in roles/run.admin roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member=serviceAccount:$DEPLOYER_SA --role=$role
done
gcloud iam service-accounts add-iam-policy-binding $RUNTIME_SA \
  --member=serviceAccount:$DEPLOYER_SA --role=roles/iam.serviceAccountUser
```

### 3.5 Secret Manager

```bash
# วาง connection string จาก Neon (ขั้น 2) ตอนที่ระบบรอ input แล้วกด Ctrl-D
gcloud secrets create database-url --data-file=-
gcloud secrets create database-url-direct --data-file=-

# JWT secret สุ่มใหม่ ห้ามใช้ค่าเดียวกับ dev
openssl rand -base64 48 | tr -d '\n' | gcloud secrets create jwt-secret --data-file=-

for s in database-url database-url-direct jwt-secret; do
  gcloud secrets add-iam-policy-binding $s \
    --member=serviceAccount:$RUNTIME_SA --role=roles/secretmanager.secretAccessor
done
```

> **ห้าม** ใส่ค่าพวกนี้ใน GitHub secrets หรือในไฟล์ใดๆ ให้อยู่ใน Secret Manager ที่เดียว

### 3.6 Workload Identity Federation (GitHub → GCP แบบไม่มี key file)

```bash
gcloud iam workload-identity-pools create github --location=global \
  --display-name="GitHub Actions"

# จำกัดให้ token จาก repo นี้เท่านั้นที่แลกสิทธิ์ได้
gcloud iam workload-identity-pools providers create-oidc rep-right \
  --location=global --workload-identity-pool=github \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository=='$GH_REPO' && assertion.ref=='refs/heads/main'"

export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
gcloud iam service-accounts add-iam-policy-binding $DEPLOYER_SA \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$GH_REPO"

# ค่านี้ต้องเอาไปใส่ GitHub ในขั้น 3.8
echo "projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/rep-right"
```

### 3.7 Deploy ครั้งแรกด้วยมือ (เพื่อให้ได้ URL ของ API)

ทำครั้งเดียว หลังจากนี้ GitHub Actions จะ deploy ให้เอง

```bash
cd apps/api
export IMAGE=$REGION-docker.pkg.dev/$PROJECT_ID/repright/api:bootstrap
gcloud auth configure-docker $REGION-docker.pkg.dev
docker build --platform linux/amd64 -t $IMAGE . && docker push $IMAGE

gcloud run jobs deploy repright-migrate --image=$IMAGE --region=$REGION \
  --service-account=$RUNTIME_SA --args=migrate,up \
  --set-env-vars=APP_ENV=production \
  --set-secrets=DATABASE_URL=database-url-direct:latest \
  --max-retries=0 --task-timeout=120s --execute-now --wait

gcloud run deploy repright-api --image=$IMAGE --region=$REGION \
  --service-account=$RUNTIME_SA --allow-unauthenticated \
  --set-env-vars=APP_ENV=production,ALLOWED_ORIGINS=http://localhost:3000 \
  --set-secrets=DATABASE_URL=database-url:latest,JWT_SECRET=jwt-secret:latest \
  --cpu=1 --memory=256Mi --min-instances=0 --max-instances=3 --concurrency=80

curl "$(gcloud run services describe repright-api --region=$REGION --format='value(status.url)')/healthz"
# ต้องได้ {"status":"ok"}
```

> ต้องใส่ `--platform linux/amd64` เพราะ build บน Mac (arm64) แต่ Cloud Run รัน amd64
> `max-instances=3` ป้องกันค่าใช้จ่ายพุ่งและกัน connection ล้น Neon free tier

### 3.8 ตั้งค่าใน GitHub ให้ workflow deploy ทำงาน

Settings → Secrets and variables → Actions → **Variables** (ไม่ต้องใช้ secrets เลย):

| Variable | ค่า |
|---|---|
| `GCP_PROJECT_ID` | `$PROJECT_ID` |
| `GCP_REGION` | `asia-southeast1` |
| `GCP_WIF_PROVIDER` | ค่าที่ echo จากขั้น 3.6 |
| `GCP_DEPLOYER_SA` | `$DEPLOYER_SA` |
| `GCP_RUNTIME_SA` | `$RUNTIME_SA` |
| `API_ALLOWED_ORIGINS` | origin ของเว็บ เช่น `https://rep-right.vercel.app` |
| `GOOGLE_CLIENT_ID` | จากขั้น 4 (ใส่ทีหลังได้) |

หลังจากนี้ merge เข้า `main` → ci ผ่าน → `deploy-api.yml` จะ build, migrate และ deploy ให้อัตโนมัติ

ถ้า `GCP_PROJECT_ID` ยังว่าง workflow deploy จะ skip เอง ไม่ fail

## 4. Google OAuth (ใช้ตั้งแต่ Phase 1)

Console → APIs & Services

1. **OAuth consent screen**
   - User type: External
   - App name: rep-right
   - Support email: ใส่อีเมลของคุณ
   - Scopes: `openid`, `email`, `profile` เท่านั้น
   - ระหว่างพัฒนาอยู่ในสถานะ Testing และต้องเพิ่ม Test users ทีละคน
   - กด Publish เมื่อพร้อมเปิดให้ทุกคนใช้
2. **Credentials → Create OAuth client ID → Web application**
   - Authorized JavaScript origins:
     - `http://localhost:3000`
     - `https://rep-right.vercel.app` (และ custom domain ถ้ามี)
   - Redirect URIs: ไม่ต้องใส่ เพราะใช้ Google Identity Services แบบ ID token
3. Client ID ไม่ใช่ secret ใช้ใส่ใน:
   - GitHub variable `GOOGLE_CLIENT_ID` (ฝั่ง API ใช้เช็ค `aud`)
   - Vercel env `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
   - `.env` ตอน dev

## 5. Vercel: เว็บ (เมื่อมี `apps/web` ใน Phase 4)

1. vercel.com → Add New Project → Import `thakornt/rep-right`
2. **Root Directory:** `apps/web` (Framework จะตรวจเจอ Next.js เอง)
3. Environment Variables (Production + Preview):

   | Name | ค่า |
   |---|---|
   | `API_ORIGIN` | URL ของ Cloud Run จากขั้น 3.7 ใช้ฝั่ง server ใน rewrite |
   | `NEXT_PUBLIC_API_URL` | `/api` (เรียกผ่าน rewrite ให้เป็น same-origin) |
   | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | จากขั้น 4 |

4. Settings → Git: Production Branch = `main`
   - Vercel สร้าง preview ให้ทุก PR และ deploy production เมื่อ merge
5. Settings → Build → **Ignored Build Step:** `git diff --quiet HEAD^ HEAD -- apps/web`
   - ถ้าแก้แค่ API จะไม่ build เว็บใหม่
6. ใน `apps/web/next.config.ts` (จะทำใน Phase 4):
   ```ts
   async rewrites() {
     return [{ source: "/api/:path*", destination: `${process.env.API_ORIGIN}/:path*` }];
   }
   ```
7. ไปอัปเดต `API_ALLOWED_ORIGINS` (GitHub) และ Authorized origins (Google) ให้มี domain ของ Vercel

> Preview deployment ของ Vercel แต่ละ PR ได้ URL ใหม่ทุกครั้ง จึง login ด้วย Google ไม่ได้ถ้าไม่เพิ่ม origin
> ทางแก้คือใช้ custom domain สำหรับ preview หรือทดสอบ login บน production/localhost

## 6. Sentry (ทางเลือก ทำหลัง Phase 1 ได้)

1. sentry.io → สร้าง org แล้วสร้าง 2 projects: `repright-api` (Go) และ `repright-web` (Next.js)
2. DSN ของ API:
   ```bash
   gcloud secrets create sentry-dsn --data-file=-
   ```
   แล้วเพิ่ม `SENTRY_DSN=sentry-dsn:latest` ใน `--set-secrets` ของ `deploy-api.yml`
3. DSN ของเว็บ: ใส่ใน Vercel env `NEXT_PUBLIC_SENTRY_DSN`
4. ตั้ง **data scrubbing** ไม่ให้ส่ง cookie, `Authorization` header และ request body
   - ข้อมูลสุขภาพ เช่น `pain_flag` ห้ามหลุดไปที่ Sentry (PDPA)

## 7. Custom domain (ทีหลัง)

เมื่อมีโดเมน เช่น `repright.app`:

1. ชี้ `repright.app` ไปที่ Vercel (Settings → Domains)
2. API ยังเรียกผ่าน rewrite ได้เหมือนเดิม จึงไม่ต้องมี `api.` subdomain
3. อัปเดต `API_ALLOWED_ORIGINS` และ Google OAuth origins

---

## Rollback

```bash
# ดู revision ทั้งหมด แล้วสลับ traffic กลับไป revision เก่า (ทำได้ในไม่กี่วินาที)
gcloud run revisions list --service=repright-api --region=asia-southeast1
gcloud run services update-traffic repright-api --region=asia-southeast1 --to-revisions=REVISION_NAME=100
```

Migration ไม่ rollback อัตโนมัติ ให้เขียน migration แบบ **expand → contract**:
1. เพิ่ม column ใหม่แบบ nullable
2. deploy code ที่ใช้ได้ทั้งของเก่าและใหม่
3. ค่อยลบของเก่าใน migration ถัดไป

วิธีนี้ทำให้ code revision ก่อนหน้ายังรันกับ schema ใหม่ได้

## ค่าที่ต้องจด

| ค่า | ได้จากขั้น | ใช้ที่ |
|---|---|---|
| Neon pooled URL | 2 | Secret `database-url` |
| Neon direct URL | 2 | Secret `database-url-direct` |
| `PROJECT_ID`, `PROJECT_NUMBER` | 3.1, 3.6 | GitHub variables |
| WIF provider path | 3.6 | `GCP_WIF_PROVIDER` |
| Cloud Run URL | 3.7 | Vercel `API_ORIGIN` |
| Google Client ID | 4 | GitHub `GOOGLE_CLIENT_ID`, Vercel, `.env` |
| Vercel domain | 5 | `API_ALLOWED_ORIGINS`, Google OAuth origins |
