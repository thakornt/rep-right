# Project Brief: Form-First Strength App (rep-right)

## 1. เป้าหมายของโปรดักต์

เว็บแอป (PWA) สำหรับ **คนเล่นเวทระดับเริ่มต้นถึงปานกลางที่ไม่มีเทรนเนอร์** ช่วยให้
1. เข้าใจฟอร์มที่ถูกต้องผ่านภาพ 3D ที่หมุนดูได้หลายมุม
2. บันทึกการซ้อมได้เร็ว
3. ได้รับคำเตือนเมื่อเพิ่มน้ำหนักหรือปริมาณเร็วเกินไป
4. ได้แผนกลับมาซ้อมอย่างปลอดภัยหลังหยุดไป

ลำดับความสำคัญของโปรดักต์: **ความปลอดภัย > ความต่อเนื่อง > อาหาร = พักผ่อน**
ทุกการตัดสินใจเรื่องฟีเจอร์ให้ยึดลำดับนี้

## 2. สิ่งที่แอปไม่ทำ (สำคัญ)

- ไม่วินิจฉัยอาการบาดเจ็บ ไม่ให้คำแนะนำทางการแพทย์
- ไม่ตรวจฟอร์มผ่านกล้องใน MVP (ทำให้แม่นยาก และถ้าบอกผิดว่าฟอร์มถูกจะเป็นความเสี่ยงเอง)
- ถ้าผู้ใช้รายงานว่ามีอาการเจ็บ ให้หยุดแนะนำการเพิ่มน้ำหนัก และแนะนำให้พบผู้เชี่ยวชาญ

## 3. Tech Stack

| ส่วน | เลือกใช้ |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS, PWA |
| 3D | three.js ผ่าน `@react-three/fiber` + `@react-three/drei` |
| Backend API | Go + Gin |
| Database | PostgreSQL |
| DB access | `pgx` + `sqlc` (type-safe query) |
| Migration | `goose` หรือ `golang-migrate` (เลือกหนึ่ง ระบุเหตุผลใน README) |
| Auth | Google Sign-In (ช่วงแรกมีแค่ Google) |
| Local dev | Docker Compose (api + postgres) |
| Deploy (เริ่มต้น ฟรี/ถูก) | Web: Vercel, API: Fly.io หรือ Cloud Run, DB: Neon หรือ Supabase Postgres |
| Observability | structured log (`slog` หรือ `zap`), Sentry free tier |

หลักการ scale: 3D ทำงานในเบราว์เซอร์ทั้งหมด ฝั่ง server รับแค่ log การซ้อม (ข้อมูลเล็ก)
**ห้ามใช้ Kubernetes ในช่วงแรก** ให้ API เป็น stateless container เพื่อ scale ออกแนวนอนได้ภายหลัง

## 4. โครงสร้าง Repo (monorepo)

```
/apps
  /web            Next.js frontend
  /api            Go (Gin) service
    /cmd/api      main.go
    /internal
      /config
      /http       router, middleware, handlers
      /auth       Google ID token verify, session JWT
      /domain     business logic (pure Go, test ได้โดยไม่ต้องมี DB)
        /load     กติกาเตือนโหลด
        /returnplan  แผนกลับมาซ้อม
      /store      sqlc generated + repository
    /db
      /migrations
      /queries    .sql สำหรับ sqlc
/docker-compose.yml
/README.md
```

## 5. Auth Flow (Google only)

1. Frontend ใช้ Google Identity Services ได้ **ID token** มา
2. ส่ง ID token ไปที่ `POST /v1/auth/google`
3. Go verify token ด้วย `google.golang.org/api/idtoken` (เช็ค `aud` = Google Client ID ของเรา)
4. หา/สร้าง user จาก `sub` ของ Google
5. Go ออก session ของเราเอง
   - access token (JWT อายุ 15 นาที)
   - refresh token อายุ 30 วัน เก็บใน **httpOnly, Secure, SameSite cookie**
   - ทำ **refresh token rotation** และเก็บ hash ของ refresh token ใน DB เพื่อ revoke ได้
6. `POST /v1/auth/refresh`, `POST /v1/auth/logout`
7. Frontend มี interceptor ดัก 401 แล้ว refresh อัตโนมัติ พร้อม queue กัน request ยิง refresh ซ้ำพร้อมกัน

ห้ามเก็บ token ใน localStorage

## 6. Data Model (เริ่มต้น)

```
users            id, google_sub (unique), email, display_name, created_at, deleted_at
consents         user_id, kind ('terms','health_data'), version, accepted_at
refresh_tokens   id, user_id, token_hash, expires_at, revoked_at, replaced_by
exercises        id, slug ('back-squat'), name_th, name_en, category, is_lower_body
sessions         id, user_id, performed_at (date), notes, pain_flag (bool)
sets             id, session_id, exercise_id, set_index, weight_kg, reps, rpe (nullable, 1-10)
```

- เก็บข้อมูลเท่าที่จำเป็น ยังไม่เก็บประวัติโรคหรืออาการบาดเจ็บละเอียด
- `pain_flag` เก็บเป็นแค่ boolean ต่อ session และต้องมี consent `health_data` ก่อน
- รองรับลบบัญชีและข้อมูลทั้งหมด (PDPA)

## 7. API (v1)

```
POST   /v1/auth/google
POST   /v1/auth/refresh
POST   /v1/auth/logout
GET    /v1/me
DELETE /v1/me                         ลบบัญชี + ข้อมูลทั้งหมด
GET    /v1/me/consents
POST   /v1/me/consents                {kind: terms|health_data, version}
DELETE /v1/me/consents/:kind          ถอน consent (health_data → ล้าง pain_flag ทั้งหมด)

GET    /v1/exercises
GET    /v1/sessions?from=&to=
POST   /v1/sessions                   สร้าง session พร้อม sets
GET    /v1/sessions/:id
PUT    /v1/sessions/:id
DELETE /v1/sessions/:id
GET    /v1/sessions/last?exercise=    ใช้ทำปุ่ม "เหมือนครั้งก่อน"

GET    /v1/insights/load              ผลวิเคราะห์โหลดล่าสุดต่อท่า
GET    /v1/insights/return-plan       แผนกลับมาซ้อม (ถ้าหยุดไปนาน)
GET    /healthz
```

Error format เดียวกันทุก endpoint: `{ "error": { "code": "...", "message": "..." } }`

## 8. กติกาเตือนโหลด (`internal/domain/load`)

ค่าเริ่มต้นแบบระมัดระวัง ใส่เป็น config ปรับได้ และเขียน unit test ครบทุกกติกา

| กติกา | เงื่อนไข | ระดับ |
|---|---|---|
| น้ำหนักกระโดด | top set เพิ่ม > 10% (ท่าล่างตัว) หรือ > 5% (ท่าบนตัว) จาก session ก่อนของท่าเดียวกัน และเพิ่มเกิน 2.5 กก. (ขั้นเล็กสุดของดัมเบล/เครื่อง ไม่นับ) | ระวัง |
| ปริมาณพุ่ง | volume สัปดาห์นี้ (น้ำหนัก × ครั้ง) / ค่าเฉลี่ย 4 สัปดาห์ก่อน > 1.3 | ระวัง, > 1.5 = เสี่ยง |
| ใกล้สุดแรงติดกัน | RPE ≥ 9 ตั้งแต่ 2 session ติดกันในท่าเดียว | แนะนำคงน้ำหนัก |
| มีอาการเจ็บ | `pain_flag` = true | หยุดแนะนำเพิ่มน้ำหนัก + แนะนำพบผู้เชี่ยวชาญ |

ข้อความถึงผู้ใช้ต้องบอกว่าเป็น **แนวทางทั่วไป** ไม่ใช่คำวินิจฉัย
หมายเหตุใน code: อัตราส่วน acute:chronic ยังเป็นที่ถกเถียงในงานวิจัย ใช้เป็นสัญญาณเตือน ไม่ใช่ตัวทำนาย

## 9. แผนกลับมาซ้อม (`internal/domain/returnplan`)

คำนวณจากวันที่ซ้อมล่าสุดของแต่ละท่า และ top set ก่อนหยุด

| หยุดไป | เริ่มที่ % ของน้ำหนักเดิม | ไต่กลับภายใน |
|---|---|---|
| < 7 วัน | 100% | - |
| 1-2 สัปดาห์ | 90% | 1 สัปดาห์ |
| 2-4 สัปดาห์ | 80% | 2 สัปดาห์ |
| 4-8 สัปดาห์ | 70% | 3 สัปดาห์ |
| > 8 สัปดาห์ | 50-60% | 4 สัปดาห์ |

ปัดน้ำหนักลงเป็นทวีคูณ 2.5 กก. เป็นค่า config ปรับได้ มี unit test

## 10. Frontend (หน้าแรกที่ต้องมี)

1. **หน้า 3D Form (public ไม่ต้อง login)** เริ่มจาก back squat
   - มุมกล้อง: ด้านข้าง, ด้านหน้า, ด้านหลัง, เฉียง 45° และลากหมุนได้
   - slider ความลึก, toggle จำลองฟอร์มผิด: โน้มตัวมากเกิน, หลังงอ/butt wink, เข่าบีบเข้าใน, ส้นเท้ายก
   - แสดงค่า: มุมลำตัว, มุมหน้าแข้ง, มุมงอเข่า, มุมงอสะโพก, ความลึกเทียบขนาน, เส้นบาร์เหนือกลางเท้า
   - ทำ SEO ได้ แชร์ลิงก์ได้
2. Login ด้วย Google
3. บันทึก session แบบเร็ว: ปุ่ม "เหมือนครั้งก่อน", แก้แค่ตัวเลข, RPE เป็นตัวเลือก
4. หน้าสรุปคำเตือนโหลด + แผนกลับมาซ้อม
5. หน้า consent และหน้าลบบัญชี

UI ภาษาไทยเป็นหลัก ใช้งานบนมือถือในยิมได้สะดวก (ปุ่มใหญ่ กรอกน้อย)
ผู้ใช้หลักเป็นมือใหม่: ห้ามใช้ตัวย่อหรือศัพท์เฉพาะ (เช่น RPE, top set, volume) ใน UI โดยไม่อธิบาย ให้ใช้คำไทยที่เข้าใจได้ทันที (เช่น "เหลือแรงอีกกี่ครั้ง", "เซ็ตที่หนักที่สุด") และถ้าจำเป็นต้องมีศัพท์ ให้มีปุ่ม ⓘ อธิบาย

## 11. ลำดับการทำ (Phase)

- **Phase 0:** monorepo, Docker Compose, Go skeleton + `/healthz`, migration แรก, CI (lint + test)
- **Phase 1:** Google auth ครบ flow + `/v1/me`
- **Phase 2:** exercises + sessions/sets CRUD
- **Phase 3:** domain `load` + `returnplan` พร้อม unit test + endpoint insights
- **Phase 4:** frontend: หน้า 3D squat, login, log, insights
- **Phase 5:** deploy (Vercel + Fly.io/Cloud Run + Neon/Supabase) และเขียนขั้นตอนใน README

## 12. ข้อกำหนดการเขียนโค้ด

- Business logic อยู่ใน `internal/domain` เป็น pure function ไม่แตะ DB หรือ HTTP
- ทุก handler รับ `context.Context` และส่งต่อไปถึง DB (ห้าม `context.TODO()` ใน code จริง)
- Config ผ่าน environment variables มี `.env.example`
- ห้าม commit secret
- เขียน test สำหรับ domain logic และ auth ก่อนอย่างอื่น
- Commit เป็นก้อนเล็กตาม phase

## 13. Environment Variables

```
# api
DATABASE_URL=
GOOGLE_CLIENT_ID=
JWT_SECRET=
ALLOWED_ORIGINS=http://localhost:3000
COOKIE_DOMAIN=localhost

# web
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```
