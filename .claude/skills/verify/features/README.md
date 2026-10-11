# อบต.หัวงัว citizen-help — verification map

โฟลเดอร์นี้คือแหล่งที่ดูแลเรื่องการยืนยันพฤติกรรมฝั่ง user-facing ของแอป
อ่าน index นี้ก่อนขับแอป แล้วใช้ไฟล์ฟีเจอร์ที่ตรงกันเป็นพิสูจน์ —
proof ที่ขับ entry point หน่วยเดียวไม่พอถ้า map มีหลาย entry

## Baseline preconditions

- Docker Desktop รันอยู่ และ `docker compose up -d postgres redis up-redis` ขึ้นครบ
  (Postgres :5433, up-redis :8081)
- รัน `npx drizzle-kit push` แล้ว และ seed แล้ว (`scripts/seed.ts` + `scripts/seed-villages.ts`)
- dev server ตอบอยู่ที่ `http://localhost:3000` (เช็กด้วย doctor ใน `.claude/skills/verify/SKILL.md`)
- geography ไม่ว่าง: provinces ≈ 77, villages ≈ 80396, categories = 13
- superadmin seed: `admin@huangua.go.th` / `ChangeMe123!` (local dev เท่านั้น)
- ไม่ drive instance ที่ไม่ได้เริ่มจากรอบ verification นี้

## Driving conventions

- Playwright spec ที่มีอยู่แล้วใน `e2e/` คือ harness หลัก — prefer รัน spec อยู่แล้วกว่าเขียนใหม่
- ใช้ ARIA role + accessible name หรือ label ภาษาไทย
  (เช่น `getByLabel('เลขบัตรประชาชน 13 หลัก')`) ไม่ใช้ตำแหน่ง DOM หรือ CSS selector ที่พังง่าย
- e2e แชร์ Postgres/Redis ตัวเดียวกับ dev stack — รันทีละ spec ไม่ขนาน
- ทุกคำสั่งถือเป็น literal — คงชื่อ flag และ label ไว้ตรงตามที่เขียน ต้องไม่แปล
- reset rate-limit ก่อน drive มือ (`e2e/helpers/reset-rate-limits.ts`) ไม่งั้นได้ 429
- drive `/admin` ทุกหน้าต้อง login ก่อน — session cookie ครอบคลุมทั้ง session
- cleanup ลบแถวทดสอบ แต่เก็บ evidence ไว้ — ห้ามลบ `.verify-evidence/`

## Proof and skip reporting

- เก็บทั้ง action และ resulting state — กดส่งเรื่อง ต้องเห็นหน้าเรียบร้อย
  **และ** ค้นแถวใน `cases` ด้วย tracking code
- UI proof: screenshot + trace (`--trace on --screenshot on`) และ heading/ข้อความไทยที่ปรากฏ
- API proof: response body + HTTP status code ทั้งคู่
- mutation proof: ต้องอ่าน state ครั้งที่สองจาก view อีกทาง
  (เช่น เปิด `/track?id=<code>` เพื่อยืนยันเคสที่เพิ่งส่ง)
- อย่ารายงาน entry point ที่ข้ามไป ว่า verified ผ่านทางอื่น
- รายงาน path ที่ไปไม่ได้: บอกคำสั่งที่ลอง + precondition ที่ไม่ผ่าน

## Features

- [แจ้งเรื่องใหม่ (intake)](./intake.md) — ฟอร์มสาธารณะ `/intake` รวม geography cascade, PDPA consent, dedup
- [ค้นหาและติดตามเรื่อง (track)](./track.md) — `/track` ค้นหาด้วยเลขติดตาม + "เรื่องของฉัน" ผ่าน LIFF
- [เข้าสู่ระบบ admin](./admin-auth.md) — login/logout/session lifetime/route guarding ที่ `/admin/*`
- [แชทกับประชาชนผ่าน LINE](./admin-chat.md) — โต๊ะงาน `/admin/chat`: รายการ/กรอง/ค้นหา/ตอบกลับ/canned/tags/SSE
- [LINE chatbot webhook](./line-webhook.md) — ยิง event เข้า `/api/line/webhook` จริงแล้วเช็ก reply/handoff
