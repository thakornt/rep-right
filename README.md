# rep-right

แอปช่วยคนเล่นเวทที่ไม่มีเทรนเนอร์: ดูฟอร์มแบบ 3D, บันทึกการซ้อมเร็ว, เตือนเมื่อเพิ่มโหลดเร็วเกิน, แผนกลับมาซ้อมหลังหยุด
รายละเอียดโปรดักต์และกติกาทั้งหมดอยู่ใน [CLAUDE.md](CLAUDE.md)

## Quick start (local)

ต้องมี Go 1.26+, Docker

```bash
make up                      # postgres + migrate + api ที่ :8080
curl localhost:8080/healthz  # {"status":"ok"}
make test                    # unit tests
make test-db                 # รวม integration test กับ Postgres (ต้อง make up ก่อน)
```

คำสั่งอื่น: `make sqlc` (generate query), `make migrate`, `make lint` (รัน golangci-lint ผ่าน Docker), `make down`

## Layout

```
apps/api          Go (Gin) API
  cmd/api         main: `api serve` | `api migrate up|down|status`
  internal/config env config
  internal/http   router, middleware, handlers
  internal/store  pgx pool, migrations runner, dbgen/ (sqlc output)
  db/migrations   goose SQL migrations (ฝังใน binary)
  db/queries      SQL สำหรับ sqlc
apps/web          Next.js (Phase 4)
```

## การตัดสินใจทางเทคนิค

- **goose (ไม่ใช้ golang-migrate):** up/down อยู่ในไฟล์เดียว sqlc อ่าน format ของ goose ได้ตรงๆ และใช้เป็น library ได้ จึงฝัง migration ไว้ใน binary แล้วรันด้วย `api migrate up` ได้ ตอน deploy ไม่ต้องมี image แยกสำหรับ migration
- **sqlc เป็น `tool` ใน go.mod:** ใช้ผ่าน `go tool sqlc` ได้เลยโดยไม่ต้องติดตั้ง global และ CI ใช้เวอร์ชันเดียวกับเครื่อง dev
- **Postgres ใน compose ใช้พอร์ต 55432:** กันชนกับ Postgres อื่นบนเครื่อง (5432/5433 มักมีคนใช้) เปลี่ยนได้ด้วย `POSTGRES_PORT`
- **Render (Singapore) + Neon (Singapore):** เริ่มได้ฟรีโดยไม่ต้องผูกบัตร และใช้ Dockerfile เดิม เมื่อจะ scale ให้เปลี่ยน instance type ในหน้า Render ได้เลยโดยไม่ต้องแก้โค้ด ส่วน Cloud Run ต้องผูกบัตรและจ่ายล่วงหน้า แต่มีคู่มือเผื่อย้ายไว้ที่ `docs/cloudrun/`
- **Same-origin ผ่าน Next.js rewrite `/api/*`:** refresh cookie จะเป็น first-party จึงไม่โดน Safari/iOS บล็อก
- **ลบบัญชีแบบ hard delete:** ข้อมูลทุกตารางผูก `ON DELETE CASCADE` กับ `users` ตามหลัก PDPA

## Deploy

ขั้นตอน deploy และ CI/CD ทุก platform (GitHub, Neon, Google OAuth, Render, Vercel, Sentry): [docs/DEPLOY.md](docs/DEPLOY.md)
