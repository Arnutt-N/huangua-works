# เข้าสู่ระบบ admin

เจ้าหน้าที่ login ที่ `/admin/login` ด้วยอีเมล+รหัสผ่าน (Auth.js v5 Credentials + bcrypt)
เมื่อผ่านเข้าหลัก `/admin` หน้า `/admin/*` ถูกล็อกด้วย `proxy.ts` (Next 16 เปลี่ยนชื่อจาก
`middleware.ts`) — ไม่ login จะถูกเด้งกลับ `/admin/login` และ logout จากเมนู avatar
ต้องยืนยันใน dialog ก่อนออกจริง

## Sub-features

- `admin-gate` เปิด `/admin` หรือ `/admin/chat` โดยไม่ได้ login → เด้งกลับ `/admin/login`
- `admin-login-wrong` อีเมลถูก รหัสผิด → ข้อความ `อีเมลหรือรหัสผ่านไม่ถูกต้อง` และอยู่หน้าเดิม
- `admin-login-bounce-back` login แล้วเปิด `/admin/login` → เด้งกลับ `/admin`
- `admin-logout` ออกจากระบบผ่านเมนู avatar → ยืนยันใน dialog → กลับหน้า login และ route ถูกล็อกอีก
- `admin-session-lifetime` ติ๊ก `จดจำฉัน` = session ~30 วัน ไม่ติ๊ก = ~1 ชั่วโมง (บังคับด้วย claim `expiresAt` ใน JWT ทั้ง edge และ node runtime)
- `admin-rate-limit` login ล้ม 5 ครั้ง/15 นาทีต่อ IP และต่อ email → ข้อความแจ้งล็อกชั่วคราว (ไม่ใช่ข้อความรหัสผิด)
- `admin-login-form` หน้า login มี checkbox `จดจำฉัน` (ติ๊กอยู่แล้ว), ลิงก์ `ลืมรหัสผ่าน?`, ข้อความติดต่อ

## How to get to it (user POV)

- เปิด `http://localhost:3000/admin/login`
- คลิกเมนู/protected route ใดก็ได้โดยยังไม่ login (ระบบเด้งเอง)

Login: `admin@huangua.go.th` / `ChangeMe123!` (superadmin ที่ seed ไว้ใน local dev)

## Driving it with Playwright

Preconditions:

- dev server ตอบ 200 ที่ `/admin/login`
- superadmin seed มี password hash แล้ว (`npx tsx scripts/seed.ts`)
- rate-limit login ถูกล้างก่อน (login ล้ม 5 ครั้ง/15 นาทีต่อ email+IP):
  `await resetRateLimits(rateLimitKey('adminLoginIp', '::1'), rateLimitKey('adminLoginEmail', 'admin@huangua.go.th'))`

- **route ถูกล็อก.** `page.goto('/admin')`. URL ลงท้ายด้วย `/admin/login` (อาจมี `?callbackUrl=`)
- **รหัสผิด.** `page.goto('/admin/login')`, `page.getByLabel('อีเมล').fill('admin@huangua.go.th')`, `page.getByLabel('รหัสผ่าน').fill('WrongPassword123')`, `page.getByRole('button', { name: /เข้าระบบ/ }).click()`. ข้อความ `อีเมลหรือรหัสผ่านไม่ถูกต้อง` ปรากฏ และยังอยู่ `/admin/login`

- **login สำเร็จ.** กรอกอีเมล+รหัสถูก แล้วกด `เข้าระบบ`. URL ลงท้าย `/admin` และ heading `แดชบอร์ดเจ้าหน้าที่` ปรากฏ (cold compile ใช้ 30-60s — ตั้ง timeout 60_000)
- **bounce-back.** login อยู่แล้วเปิด `/admin/login`. URL กลายเป็น `/admin` ภายใน 10s

- **logout.** `page.getByRole('button', { name: 'เมนูผู้ใช้' }).click()`, `page.getByRole('menuitem', { name: 'ออกจากระบบ' }).click()`, แล้วยืนยัน `page.getByRole('button', { name: 'ออกจากระบบ' }).click()`. URL กลายเป็น `/admin/login` และเปิด `/admin` อีกครั้งถูกล็อก — ใช้ `getByRole('button', …)` ในการยืนยัน เพราะหลังจากกด menuitem แล้ว Radix อาจคง menuitem นั้นอยู่ใน DOM อยู่อีกครู่ ๆ ถ้า assert แบบ strict จะเจอสองตัว

- **rate-limit (ถ้าจะพิสูจน์).** กรอกรหัสผิด >= 6 ครั้งติดจาก IP+email เดิมโดยไม่ reset. ลองที่ 6 ข้อความจะเป็น `เข้าสู่ระบบถี่เกินไป กรุณารอ 900 วินาที` (ไม่ใช่ข้อความรหัสผิด) — พิสูจน์ได้แต่จะล็อก test รอบถัดไป อย่างดี 30s+ อย่าทำถ้ารันชุดใหญ่

- **proof (UI).** screenshot หน้า `แดชบอร์ดเจ้าหน้าที่` หลัง login + screenshot หน้า login หลัง logout

- **session lifetime (proof ขั้นสูง).** ต้องมี `AUTH_SECRET` ใน env — decode session cookie ด้วย `next-auth/jwt`:
  `const session = (await page.context().cookies()).find((c) => c.name.endsWith('authjs.session-token'))`
  แล้วอ่าน claim `expiresAt` — ติ๊ก `จดจำฉัน` ต้องได้ ~30 วัน ไม่ติ๊กต้องได้ ~1 ชั่วโมง

## Gotchas

- URL หลังถูกเด้งอาจมี `?callbackUrl=…` — assert pathname เท่านั้น อย่าบังคับว่า query ว่าง
- **ไม่ใช่ทุก `/admin/*` ถูกล็อก** — `PUBLIC_ADMIN_PATHS` มี 3 เส้นทางที่ไม่ต้อง login: `/admin/login`, `/admin/forgot-password`, `/admin/reset-password` (`src/auth.config.ts:60`) และถ้า login อยู่แล้ว 3 เส้นทางนี้**ไม่** เด้งกลับ `/admin` (authorized() คืน true) — ยกเว้น `/admin/login` ที่ proxy redirect เอง เจอแค่ 2 เรื่องนี้อย่าสับสนว่า gate เพี้ยน
- login ล้มมีข้อความ 4 แบบ ขึ้นกับสาเหตุ (`src/app/admin/actions.ts`): `อีเมลหรือรหัสผ่านไม่ถูกต้อง` (รหัสผิด), `เข้าสู่ระบบถี่เกินไป กรุณารอ ${reset} วินาที` (rate limit), `บัญชีนี้ถูกระงับการใช้งาน` (isActive false), `บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานส่วนเจ้าหน้าที่` (role citizen) — assert ข้อความที่ตรงกับเงื่อนไขที่ทดสอบ อย่า assert ข้อความแรกลอย ๆ
- ช่อง `รหัสผ่าน` มีปุ่มสลับมองเห็น (`aria-label` = `แสดงรหัส`/`ซ่อนรหัส`) อยู่ท้าย input — ถ้า `getByLabel('รหัสผ่าน')` แบบ strict อาจเจอ 2 ตัว ใช้ `page.getByLabel('รหัสผ่าน').first()` หรือ scope ให้แน่บ
- ทุก test ที่ login ต้อง `test.slow()` — Turbopack compile แต่ละ route ช้า 20-40s บนเครื่องนี้
- `remember-me` ติ๊กอยู่แล้วโดยดีฟอลต์ — ถ้าจะเทียบอายุสั้นต้อง `uncheck()` เอง
- logout ต้องคลิก 3 ครั้ง (เปิดเมนู → เมนู item → ยืนยันใน dialog) คลิก `ออกจากระบบ` เพียงครั้งเดียวจาก context ผิดจะไม่เกิดอะไร
- cookie session มีอายุ 30d เสมอ (`session.maxAge`) — ตัวบังคับอายุจริงคือ claim `expiresAt` ใน JWT ไม่ใช่ cookie
- `authorize()` เทียบเวลาให้คงที่ภายใต้ทุกอินพุต (bcrypt เทียบกับ DUMMY_HASH เมื่อ email ไม่มีอยู่) — อย่าวัดความต่างของ response time เพื่อสร้าว่าอีเมลมีจริง
- ถ้า Redis ล่ม: policy `adminLoginIp`/`adminLoginEmail` ทั้งสองเป็น `kind: 'auth'` + `failClosed: true` (Redis ล่ม = login ปิดหมด) ส่วน path สาธารณะส่วนใหญ่ `failOpen: true` — อย่าสร้าว่าระบบเพี้ยนจาก Redis error ตัวเดียว
- reset rate-limit ใน `beforeEach` ไม่ช่วยถ้า dev server จริงยืมจาก IPv4 loopback (เช่น bind 127.0.0.1) — IP ที่เห็นเป็น `::ffff:127.0.0.1` ไม่ใช่ `::1` แล้ว `DEL` ติดลบ เช็กจาก dev log ถ้า login เริ่มได้ 429 ทั้งที่ reset ไปแล้ว
