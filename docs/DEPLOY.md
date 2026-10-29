# Deploy & CI/CD

ภาพรวม production (ทุก platform เริ่มได้ฟรีโดยไม่ต้องผูกบัตร):

```
ผู้ใช้ ──> Vercel (Next.js, apps/web)
             │  rewrite /api/*  (same-origin → refresh cookie เป็น first-party)
             ▼
          Render web service  repright-api  (Docker, Singapore)
             │
             ▼
          Neon Postgres  (aws-ap-southeast-1, Singapore)
```

Flow ของ CI/CD:

```
push / PR ──> ci.yml   (lint, sqlc diff, test + postgres, docker build)
merge main ─> ci.yml ผ่าน ──> deploy-api.yml
                                1. go run ./cmd/api migrate up  → Neon (direct)
                                   ถ้าพัง หยุด ไม่ deploy
                                2. POST Render Deploy Hook → Render build Dockerfile ใหม่
                                3. รอจน /healthz ตอบ version = commit SHA นี้
web ───────> Vercel Git integration (preview ทุก PR, production เมื่อ merge main)
```

ทำตามลำดับ เพราะขั้นหลังใช้ค่าจากขั้นก่อน จดค่าลงตาราง "ค่าที่ต้องจด" ท้ายไฟล์

---

## Step 1. GitHub

ทำด้วยบัญชี **thakornt** (owner) เพราะสิทธิ์ Write ตั้งค่าส่วนนี้ไม่ได้

### 1.1 ป้องกัน `main`

https://github.com/thakornt/rep-right/settings/branches

1. **Add classic branch protection rule** → Branch name pattern: `main`
2. ✅ **Require a pull request before merging**
   - ไม่ต้องติ๊ก Require approvals เพราะทำคนเดียว
3. ✅ **Require status checks to pass before merging**
   - ✅ Require branches to be up to date
   - ค้นหาแล้วเลือก `api`
4. ✅ **Do not allow bypassing the above settings** (ถ้าอยากให้ admin ก็ต้องผ่าน CI)
5. **Create**

### 1.2 Environment `production`

https://github.com/thakornt/rep-right/settings/environments

1. **New environment** ตั้งชื่อ `production` ต้องสะกดตรงตัว
2. **Deployment branches and tags** → Selected branches and tags → Add rule: `main`
3. Required reviewers: ช่วงแรกไม่ต้องติ๊ก ให้ deploy อัตโนมัติ
4. **Save protection rules**

ส่วน secret ของ environment นี้ค่อยกรอกใน Step 5

## Step 2. Neon (ฐานข้อมูล)

1. สมัครที่ https://console.neon.tech/signup (login ด้วย GitHub ได้)
2. **Create project**
   - Name: `repright`
   - Postgres: **17** ให้ตรงกับ docker compose
   - Region: **AWS Asia Pacific (Singapore)**
3. ในหน้าโปรเจกต์ กด **Connect** แล้ว copy connection string 2 แบบ

| แบบ | วิธีได้ | ใช้ที่ |
|---|---|---|
| **Pooled** | เปิด **Connection pooling** (host จะมีคำว่า `-pooler`) | Render env `DATABASE_URL` |
| **Direct** | ปิด Connection pooling | GitHub secret `NEON_DIRECT_URL` ใช้กับ migration |

ทั้งสองต้องลงท้ายด้วย `?sslmode=require`

> migration ต้องใช้ direct connection เพราะ goose ใช้ session-level state ที่ไม่ควรวิ่งผ่าน PgBouncer
> Neon free จะ suspend เมื่อไม่ได้ใช้ query แรกหลังตื่นจะช้าขึ้นราว 0.5-1 วินาที

## Step 3. Google OAuth (ไม่ต้องผูกบัตร ไม่ต้องเปิด billing)

1. สร้างโปรเจกต์ที่ https://console.cloud.google.com/projectcreate เช่นชื่อ `repright`
   - ถ้าระบบถามเรื่อง billing ให้ข้ามได้ OAuth ไม่ต้องใช้ billing
2. https://console.cloud.google.com/auth/overview → **Get started**
   - App name: `rep-right`, User support email: อีเมลของคุณ
   - Audience: **External**
   - Contact email: อีเมลของคุณ → Create
3. **Audience** → Test users → **Add users** ใส่อีเมล Google ที่จะใช้ทดสอบ
   - ระหว่างที่แอปอยู่ในสถานะ Testing มีแค่คนในรายชื่อนี้ที่ login ได้
4. **Data access** → Add scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` (เท่านี้พอ)
5. **Clients** → **Create client** → Application type: **Web application**
   - Name: `rep-right web`
   - Authorized JavaScript origins: `http://localhost:3000` (เพิ่ม domain ของ Vercel ใน Step 6)
   - Authorized redirect URIs: ไม่ต้องใส่ เพราะใช้ Google Identity Services แบบ ID token
6. copy **Client ID** (ลงท้ายด้วย `.apps.googleusercontent.com`)
   - ไม่ใช่ความลับ ใส่ได้ทั้ง Render, Vercel และ `.env`
   - **Client secret ไม่ได้ใช้** ห้ามใส่ไว้ที่ไหน

## Step 4. Render (API)

1. สมัครที่ https://dashboard.render.com/register ด้วย GitHub
2. https://dashboard.render.com/web/new → เชื่อม GitHub
   - ตอนติดตั้ง Render GitHub App ให้เลือก **Only select repositories** → `thakornt/rep-right`
   - ต้องให้บัญชี thakornt เป็นคนอนุมัติ
3. เลือก repo `rep-right` แล้วกรอก:

| ช่อง | ค่า |
|---|---|
| Name | `repright-api` (URL จะเป็น `https://repright-api.onrender.com` ถ้าชื่อยังว่าง) |
| Language | **Docker** |
| Branch | `main` |
| Region | **Singapore** ⚠️ เปลี่ยนทีหลังไม่ได้ ต้องสร้าง service ใหม่ |
| Root Directory | `apps/api` |
| Dockerfile Path | `./Dockerfile` |
| Instance Type | **Free** |

4. **Environment Variables** (กด Add Environment Variable ทีละตัว):

| Key | ค่า | หมายเหตุ |
|---|---|---|
| `APP_ENV` | `production` | |
| `DATABASE_URL` | Neon **pooled** URL จาก Step 2 | ความลับ |
| `JWT_SECRET` | ผลจาก `openssl rand -base64 48` | ความลับ ห้ามใช้ซ้ำกับ dev |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | เปลี่ยนเป็น domain ของ Vercel ใน Step 6 |
| `GOOGLE_CLIENT_ID` | จาก Step 3 | ใช้ตั้งแต่ Phase 1 |
| `LOG_LEVEL` | `info` | |

> **ไม่ต้องตั้ง `PORT`** Render กำหนดให้เอง และโค้ดอ่านค่าจาก `PORT` อยู่แล้ว

5. **Advanced**:
   - Health Check Path: `/healthz`
   - **Auto-Deploy: Off** ⚠️ สำคัญมาก ให้ GitHub Actions เป็นคนสั่ง deploy หลัง migrate เสร็จเท่านั้น
6. **Deploy Web Service** แล้วรอ build ประมาณ 3-5 นาที จากนั้นเปิด `https://<ชื่อ>.onrender.com/healthz` ต้องได้ `{"status":"ok","version":"..."}`
7. **Settings → Deploy Hook** → copy URL
   - **เป็นความลับ** ใครได้ URL นี้ไปจะสั่ง deploy ได้
   - ถ้าหลุด กด Regenerate

## Step 5. GitHub Secrets & Variables

### 5.1 Environment secrets (ใช้ได้เฉพาะ job ที่รันใน environment `production`)

https://github.com/thakornt/rep-right/settings/environments → `production` → **Environment secrets → Add environment secret**

| Name | ค่า |
|---|---|
| `NEON_DIRECT_URL` | Neon **direct** URL จาก Step 2 |
| `RENDER_DEPLOY_HOOK_URL` | Deploy Hook จาก Step 4.7 |

### 5.2 Repository variable

https://github.com/thakornt/rep-right/settings/variables/actions → **New repository variable**

| Name | ค่า |
|---|---|
| `API_URL` | `https://<ชื่อ>.onrender.com` ไม่มี `/` ต่อท้าย |

> `API_URL` เป็นตัวเปิดใช้ workflow deploy ถ้ายังว่าง `deploy-api` จะ skip เอง ดังนั้นให้ใส่ **หลังสุด** หลังจาก secret ครบแล้ว

### 5.3 ทดสอบ pipeline

1. https://github.com/thakornt/rep-right/actions/workflows/deploy-api.yml → **Run workflow** (branch `main`)
2. ต้องเห็น 3 ขั้นผ่านครบ: migrate → trigger Render deploy → wait until the new commit is live
3. หลังจากนี้ ทุกครั้งที่ merge PR เข้า `main` จะ deploy อัตโนมัติ

## Step 6. Vercel (Phase 4 เมื่อมี `apps/web`)

1. https://vercel.com/signup ด้วย GitHub → https://vercel.com/new → Import `thakornt/rep-right`
2. **Root Directory:** `apps/web`
3. Environment Variables (Production + Preview):

| Name | ค่า |
|---|---|
| `API_ORIGIN` | `API_URL` เดียวกับ Step 5.2 ใช้ฝั่ง server ใน rewrite |
| `NEXT_PUBLIC_API_URL` | `/api` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | จาก Step 3 |

4. Settings → Build → **Ignored Build Step:** `git diff --quiet HEAD^ HEAD -- apps/web`
5. ได้ domain มาแล้ว (เช่น `https://rep-right.vercel.app`) ให้กลับไปอัปเดต 2 ที่:
   - Render env `ALLOWED_ORIGINS`
   - Google OAuth → Clients → Authorized JavaScript origins

> Preview deployment แต่ละ PR ได้ URL ใหม่ จึง login Google ไม่ได้ ให้ทดสอบ login บน production หรือ localhost แทน

## Step 7. Sentry (ทางเลือก)

1. https://sentry.io/signup/ → สร้าง 2 projects: `repright-api` (Go) และ `repright-web` (Next.js)
2. DSN ของ API ใส่ใน Render env `SENTRY_DSN` ส่วน DSN ของเว็บใส่ใน Vercel env `NEXT_PUBLIC_SENTRY_DSN`
3. Settings → Security & Privacy → เปิด data scrubbing ไม่ให้ส่ง cookie, `Authorization` header และ request body
   - ข้อมูลสุขภาพอย่าง `pain_flag` ห้ามหลุดไปที่ Sentry (PDPA)

---

## ข้อจำกัดของ Render Free

- **Sleep เมื่อไม่มี request 15 นาที** request แรกหลังจากนั้นรอประมาณ 30-60 วินาที
  - หน้า 3D squat ไม่โดน เพราะเป็นเว็บล้วนบน Vercel
  - หน้า log/insights ที่เรียก API จะโดน
- ได้ 750 ชั่วโมงต่อเดือนต่อ workspace พอสำหรับ 1 service
- ไม่มี Pre-Deploy Command จึงให้ GitHub Actions รัน migration แทน

## Scale ในอนาคต (จ่ายเงินแล้วกดเปลี่ยนได้เลย ไม่ต้องแก้โค้ด)

| ต้องการ | ทำที่ไหน |
|---|---|
| ไม่ sleep และ spec สูงขึ้น | Render → service → **Settings → Instance Type** เปลี่ยนจาก Free เป็น Starter/Standard/Pro |
| หลาย instance (scale แนวนอน) | Settings → **Scaling** ตั้งจำนวน instance หรือ autoscaling (ต้องใช้ workspace plan แบบจ่ายเงิน) |
| ฐานข้อมูลใหญ่ขึ้น หรือ connection มากขึ้น | Neon → Billing → อัป plan แล้วปรับ compute size |

API เป็น stateless และไม่มีอะไรเก็บไว้ในเครื่อง จึงเพิ่ม instance ได้ทันที migration รันใน CI จึงไม่ชนกันระหว่าง instance

ถ้าวันหนึ่งอยากย้ายไป Cloud Run: [docs/cloudrun/CLOUD_RUN.md](cloudrun/CLOUD_RUN.md) และ workflow ที่ [docs/cloudrun/deploy-api.yml](cloudrun/deploy-api.yml)

## Rollback

- **Code:** Render → service → **Events** → เลือก deploy ก่อนหน้า → **Rollback**
- **Migration** ไม่ rollback อัตโนมัติ ให้เขียน migration แบบ **expand → contract**:
  1. เพิ่ม column ใหม่แบบ nullable
  2. deploy code ที่ใช้ได้ทั้งของเก่าและใหม่
  3. ค่อยลบของเก่าใน migration ถัดไป

  วิธีนี้ทำให้ code เวอร์ชันก่อนหน้ายังรันกับ schema ใหม่ได้

## ค่าที่ต้องจด

| ค่า | ได้จาก | ใส่ที่ | ความลับ? |
|---|---|---|---|
| Neon pooled URL | Step 2 | Render `DATABASE_URL` | ✅ |
| Neon direct URL | Step 2 | GitHub env secret `NEON_DIRECT_URL` | ✅ |
| JWT secret | `openssl rand -base64 48` | Render `JWT_SECRET` | ✅ |
| Google Client ID | Step 3 | Render `GOOGLE_CLIENT_ID`, Vercel, `.env` | ❌ |
| Render URL | Step 4 | GitHub var `API_URL`, Vercel `API_ORIGIN` | ❌ |
| Render Deploy Hook | Step 4.7 | GitHub env secret `RENDER_DEPLOY_HOOK_URL` | ✅ |
| Vercel domain | Step 6 | Render `ALLOWED_ORIGINS`, Google OAuth origins | ❌ |
