# rep-right

แอปช่วยคนเล่นเวทที่ไม่มีเทรนเนอร์: ดูฟอร์มแบบ 3D, บันทึกการซ้อมเร็ว, เตือนเมื่อเพิ่มโหลดเร็วเกิน, แผนกลับมาซ้อมหลังหยุด
รายละเอียดโปรดักต์และกติกาทั้งหมดอยู่ใน [CLAUDE.md](CLAUDE.md)

## Quick start (local)

ต้องมี Go 1.26+, Node 22+ และ Postgres อย่างใดอย่างหนึ่ง: Docker (ข้อ A) หรือ Neon branch (ข้อ B ไม่ต้องติดตั้งอะไรเพิ่ม)

**1. ตั้งค่า env ไฟล์เดียวที่ root** ทั้ง API และเว็บอ่านไฟล์นี้

```bash
cp .env.example .env
```

กรอก `GOOGLE_CLIENT_ID` กับ `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (ค่าเดียวกัน) และ `JWT_SECRET` (สุ่มอย่างน้อย 32 ตัวอักษร) ให้ comment อยู่บรรทัดของตัวเองเสมอ ถ้าเขียน `KEY=   # note` ค่าของ KEY จะกลายเป็น `# note`

**2. ฐานข้อมูล**

- **A. Docker:** `make up` (Postgres ที่ :55432 + migrate + API ที่ :8080) ใช้ `DATABASE_URL` ตาม `.env.example` ได้เลย
- **B. ไม่มี Docker:** สร้าง branch ใน Neon (Console → Branches → Create branch ชื่อ `dev` แตกจาก `production`) แล้วเอา connection string ของ branch นั้นใส่ `DATABASE_URL` ใน `.env` branch แยกจาก production ทำอะไรก็ไม่กระทบข้อมูลจริง

**3. รัน**

```bash
cd apps/api && go run ./cmd/api migrate up   # ครั้งแรก หรือเมื่อมี migration ใหม่ (ข้อ A ทำให้แล้ว)
cd apps/api && go run ./cmd/api              # API ที่ :8080
cd apps/web && npm install && npm run dev    # เว็บที่ http://localhost:3000 (/api/* proxy ไป :8080)
```

Login ด้วย Google ในเครื่องใช้ได้ที่ `http://localhost:3000` (อยู่ใน Authorized JavaScript origins แล้ว)

**ทดสอบ**

```bash
make test       # unit tests ไม่ต้องมี DB
make test-db    # รวม integration test กับ Postgres (ต้อง make up ก่อน)
```

คำสั่งอื่น: `make sqlc` (generate query), `make migrate`, `make lint` (รัน golangci-lint ผ่าน Docker), `make down`

## Layout

```
apps/api          Go (Gin) API
  cmd/api         main: `api serve` | `api migrate up|down|status`
  internal/config env config
  internal/http   router, middleware, handlers
  internal/auth   Google ID token verify, access JWT, refresh token rotation
  internal/domain pure business rules (workout: session validation)
  internal/store  pgx pool, migrations runner, dbgen/ (sqlc output)
  db/migrations   goose SQL migrations (ฝังใน binary)
  db/queries      SQL สำหรับ sqlc
apps/web          Next.js (App Router) + Tailwind, rewrite /api/* → API_ORIGIN
```

## การตัดสินใจทางเทคนิค

- **goose (ไม่ใช้ golang-migrate):** up/down อยู่ในไฟล์เดียว sqlc อ่าน format ของ goose ได้ตรงๆ และใช้เป็น library ได้ จึงฝัง migration ไว้ใน binary แล้วรันด้วย `api migrate up` ได้ ตอน deploy ไม่ต้องมี image แยกสำหรับ migration
- **sqlc เป็น `tool` ใน go.mod:** ใช้ผ่าน `go tool sqlc` ได้เลยโดยไม่ต้องติดตั้ง global และ CI ใช้เวอร์ชันเดียวกับเครื่อง dev
- **Postgres ใน compose ใช้พอร์ต 55432:** กันชนกับ Postgres อื่นบนเครื่อง (5432/5433 มักมีคนใช้) เปลี่ยนได้ด้วย `POSTGRES_PORT`
- **Render (Singapore) + Neon (Singapore):** เริ่มได้ฟรีโดยไม่ต้องผูกบัตร และใช้ Dockerfile เดิม เมื่อจะ scale ให้เปลี่ยน instance type ในหน้า Render ได้เลยโดยไม่ต้องแก้โค้ด ส่วน Cloud Run ต้องผูกบัตรและจ่ายล่วงหน้า แต่มีคู่มือเผื่อย้ายไว้ที่ `docs/cloudrun/`
- **Same-origin ผ่าน Next.js rewrite `/api/*`:** refresh cookie จะเป็น first-party จึงไม่โดน Safari/iOS บล็อก
- **Session:** access token เป็น JWT HS256 อายุ 15 นาที เก็บใน memory ของเว็บเท่านั้น ส่วน refresh token เป็นค่าสุ่ม 256 bit อยู่ใน cookie `rr_refresh` (httpOnly, Secure, SameSite=Strict) ใน DB เก็บแค่ SHA-256 ทุกครั้งที่ refresh จะออก token ใหม่ (rotation) ถ้ามีคนเอา token ที่ถูกหมุนไปแล้วมาใช้ซ้ำหลังพ้น 30 วินาที จะถือว่า token หลุด แล้ว revoke ทุก session ของ user นั้น ส่วนช่วง 30 วินาทีแรกเผื่อไว้ให้ 2 แท็บที่ refresh พร้อมกัน
- **pain_flag กับ consent:** บันทึก `pain_flag = true` ได้เฉพาะเมื่อมี consent `health_data` แล้ว ถ้าไม่มีตอบ 403 `consent_required` เมื่อถอน consent ระบบจะล้าง pain_flag ทุก session (PDPA)
- **ลบบัญชีแบบ hard delete:** ข้อมูลทุกตารางผูก `ON DELETE CASCADE` กับ `users` ตามหลัก PDPA

## Deploy

ขั้นตอน deploy และ CI/CD ทุก platform (GitHub, Neon, Google OAuth, Render, Vercel, Sentry): [docs/DEPLOY.md](docs/DEPLOY.md)
