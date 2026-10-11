# แชทกับประชาชนผ่าน LINE (admin chat)

เจ้าหน้าที่ตอบคำถาม/รับเรื่องจากผู้ที่ทัก LINE OA ผ่าน `/admin/chat` — โต๊ะงานแบบ 3 คอลัมน์ (รายการสนทนา | ห้องแชท | ข้อมูลลูกค้า) เห็นรายการบทสนทนาเรียงลำดับ กรองตามสถานะ เปิดห้องเพื่อดูประวัติข้อความ แล้วตอบกลับได้ด้วยตนเองเมื่อห้องอยู่ในโหมด `human_active` ข้อความใหม่จาก LINE เข้าหน้านี้สดผ่าน Server-Sent Events (SSE) โดยไม่ต้องรีเฟรช ไม่มีปุ่ม "รับเรื่อง" แยกอีกต่อไป — สลับผู้ตอบด้วย pill `บอท`/`เจ้าหน้าที่` แทน

หน้าที่เกี่ยวข้อง: `/admin/chat` เท่านั้น — ตั้งค่าบอท (FAQ, rich menu, สถิติ) อยู่ที่ `/admin/chatbot` แยก surface อีกตัว

## Sub-features

- `chat-gate` เปิด `/admin/chat` โดยไม่ได้ login → เด้งไป `/admin/login`
- `chat-list` รายการบทสนทนา: ชื่อ, เวลา, ข้อความล่าสุด, badge โหมดสั้น, badge unread `9+`, แท็ก (แสดงได้ 2 → `+N`), ป้าย pin/mute
- `chat-filter` ชิปกรอง 3 แบบ (`ทั้งหมด` / `รอรับ` / `กำลังคุย`) สลับ `aria-pressed` + นับจำนวนใน footer
- `chat-search` ช่อง `ค้นหาการสนทนา` กรองฝั่ง client ด้วยชื่อ + ยิง `/api/line/admin/search` (debounce 300ms) แสดงบล็อก `ผลค้นหาข้อความ (N)` แยก — **ผลไม่แทนที่รายการเดิม**
- `chat-open` เลือกห้อง → โหลดข้อความ + `markConversationRead` + เคลียร์ unread ทันที
- `chat-mode-badge` badge สถานะห้อง 4 ค่า: `Bot ตอบอัตโนมัติ` / `รอเจ้าหน้าที่` / `เจ้าหน้าที่ตอบ` / `ปิดเรื่อง`
- `chat-reply` ส่งข้อความเมื่อห้องเป็น `human_active` และไม่มีเจ้าหน้าที่คนอื่นครอบครอง (`canReply`) — composer ทำ optimistic send แล้วมีปุ่ม retry เมื่อส่งไม่สำเร็จ
- `chat-canned` กด `/` ในช่องพิมพ์ หรือกดปุ่ม `aria-label="ข้อความสำเร็จรูป"` → เปิด `listbox` ชื่อเดียวกัน (ปิดด้วย Escape / ↑↓ / Enter)
- `chat-customer-panel` แผง `ข้อมูลลูกค้า` (h2) ซ่อน/แสดงจากปุ่มใน header — ใช้ชื่อปุ่มต่างกันบน desktop/mobile
- `chat-transfer` ปุ่ม `โอนแชท` → dialog เลือกปลายทาง + เหตุผล optional (ห้องต้องเป็น `human_active` อยู่ก่อน ไม่งั้นได้ 409)
- `chat-sse` EventSource `/api/line/admin/sse` เชื่อมตลอดอายุหน้า — ข้อความใหม่ append, mode change refetch, ไม่ทำให้หน้าพัง

## How to get to it (user POV)

- เปิด `http://localhost:3000/admin/chat` ตรงๆ (ถ้าไม่ได้ login จะถูกส่งไป `/admin/login` ก่อน)
- คลิกเมนู `การสนทนา` ใน sidebar ของ `/admin` หลัง login
- ต้องมี role staff (`requireStaff()` ใช้อัตโนมัติ — `officer|chief|head|superadmin`) ถ้าเป็น `citizen` จะเข้าหน้านี้ไม่ได้ (`requireStaff` signOut + redirect)

## Driving it with Playwright

Preconditions:

- dev server ตอบ 200 ที่ `/admin/login` และ `/admin/chat` ตอบ **307** (redirect ไป login = gate ทำงาน; ถ้าได้ 200 โดยไม่มี session = auth เพี้ยน)
- superadmin seed พร้อม: `admin@huangua.go.th` / `ChangeMe123!` (`scripts/seed.ts`)
- rate-limit login ถูกล้าง: `await resetRateLimits(rateLimitKey('adminLoginIp', '::1'), rateLimitKey('adminLoginEmail', 'admin@huangua.go.th'))` — ทั้งสอง key เป็น `kind: 'auth'` + `failClosed: true` (Redis ล่ม = login ปิดหมด)
- **ตรวจว่าใน DB ไม่มี `U_test_local_webhook_user` อยู่ก่อน** — `npx tsx scripts/check-line-db.ts` (ดู gotchas เรื่อง unique constraint ด้านล่าง)
- `e2e/admin-chat.spec.ts` seed ข้อมูลเองใน `beforeAll` ไม่ต้องรัน `scripts/test-webhook.ts` ก่อน (เป็น precondition เก่า ไม่ใช้แล้ว)

- **login.** `page.goto('/admin/login')`, `page.getByLabel('อีเมล').fill('admin@huangua.go.th')`, `page.getByLabel('รหัสผ่าน').fill('ChangeMe123!')`, `page.getByRole('button', { name: /เข้าระบบ/ }).click()`. URL ลงท้าย `/admin` (cold compile 20-60s — ใช้ `test.slow()`)

- **เข้าแชท.** `page.goto('/admin/chat', { waitUntil: 'domcontentloaded' })`. URL ลงท้าย `/admin/chat` และช่อง `ค้นหาการสนทนา` ปรากฏ (timeout 20_000)

- **รายการบทสนทนา.** `page.locator('button:has-text("U_test_local")')` ต้อง visible (timeout 15_000) — นี่คือ row ที่ `beforeAll` เพิ่ง seed

- **เปิดห้อง.** คลิก row นั้น → badge สถานะปรากฏ (ยอมข้อความใดข้อความหนึ่งจาก `Bot ตอบอัตโนมัติ`, `รอเจ้าหน้าที่`, `เจ้าหน้าที่ตอบ`, `ปิดเรื่อง`)

- **filter chips.** `page.getByRole('button', { name: /ทั้งหมด/ })` มี `aria-pressed="true"` ตอนเปิด คลิก `/รอรับ/` → ชิปนั้น `true` และ `ทั้งหมด` เป็น `false` คลิกกลับมาได้ (มีชิป `กำลังคุย` อีกตัว)

- **แผงลูกค้า.** กด `ซ่อนข้อมูลลูกค้า` → heading `ข้อมูลลูกค้า` หายไป กด `แสดงข้อมูลลูกค้า` (ใช้ `.first()` เพราะมีปุ่ม desktop+mobile ชื่อซ้ำ) → ปรากฏกลับ

- **ข้อความสำเร็จรูป.** (เฉพาะเมื่อช่องพิมพ์เปิด — ต้องเป็น `human_active` และไม่มีคนอื่นครอบครอง) `page.getByLabel('พิมพ์ข้อความ').fill('/')` → `listbox` ชื่อ `ข้อความสำเร็จรูป` ปรากฏ กด Escape → หาย

- **proof.** screenshot หน้าแชทพร้อมบทสนทนา + SQL ยืนยันว่า spec ล้างของเอง: `SELECT count(*) FROM chat_conversations` กับ `line_users` ต้องกลับ 0 หลัง run (ดู gotchas เรื่อง flaky)

## Gotchas

- **⚠️ `scripts/test-webhook.ts` เป็นพิษต่อ spec นี้** — มันสร้าง `line_users.lineUserId = 'U_test_local_webhook_user'` (`scripts/test-webhook.ts:29,36`) **โดยไม่ลบ** ส่วน `e2e/admin-chat.spec.ts:24` seed ด้วย id เดียวกัน ถ้าแถวนั้นค้างอยู่ `beforeAll` จะ throw บน unique constraint (`schema.ts:473` + `:495`) ทำให้ **ทั้ง spec ล้ม 6/6 ที่ setup และไม่มี afterAll รัน** (row ค้างเพิ่ม) เช็กด้วย `npx tsx scripts/check-line-db.ts` แล้วลบแถวนั้นก่อน
- **`displayName` ตั้งให้ = `lineUserId` ตั้งใจ** (`e2e/admin-chat.spec.ts:26`) — รายการแชตแสดง displayName ตรงๆ และ `maskLineUserId` ตัดให้เห็นแค่ 8 ตัวแรก เลยให้ `U_test_local` หาเจอได้ ถ้าจะเปลี่ยนค่าต้องเปลี่ยน locator ด้วย
- **flaky เรื่อง timing** — run แรกบนเครื่องที่เพิ่งแก้โค้ดอาจล้ม 2 tests (list + filter chips) จาก cold compile ซ้อน re-drive ครบมักผ่าน 6/6 ถ้าล้ม 2-3 tests พร้อม timeout ให้ re-drive ก่อนสรุปว่า product เพี้ยน
- **อาการค้าง loading = บั๊ก hook กลาง** — ถ้าเห็น "ช่องค้นหาแสดง แต่ไม่มี row และไม่มี error" คือง `useResource` stuck: `mountedRef.current` ต้องถูกชุบเป็น `true` ใน effect setup (`src/app/admin/_lib/use-resource.ts:94-101`) ก่อน PR #98 บั๊กนี้ทำให้ 5+ หน้าค้าง skeleton ใน dev ทั้งที่ API ตอบ 200 เช็กตรงนี้ก่อน
- **dev server เก่า serve โค้ดเก่า** — ถ้า dev server สตาร์ก่อนโค้ดที่แก้ไป merge อาจไม่เห็นการแก้ เริ่มใหม่ก่อนสงสัยโค้ด
- spec มี `test.slow()` ใน test ที่ login เพราะ Turbopack compile แต่ละ route ช้า 20-40s (timeout ไฟล์ 120s)
- ทุก test login ใหม่ทั้งหน้า — reset rate-limit login ใน `beforeEach` ไม่งั้น test ที่ 6 ใน 15 นาทีจะได้ข้อความ `เข้าสู่ระบบถี่เกินไป` มาผิดทดสอบ
- tests 3 และ 6 ใช้ `isVisible()` guard ถ้าแถวหายไปกลางทาง test จะกลายเป็น silent no-op — ไม่นับว่าพิสูจน์อะไร (อย่ารายงานว่า verified)
- `/api/line/admin/*` ไม่มี rate limit (เฉพาะ auth/liff/consent/public submit+track) — ยิงซ้ำแล้วไม่ได้ 429 จาก path เหล่านี้
- หน้าจอนี้เป็นบทสนทนา LINE ไม่ใช่เคส — เคสที่เกิดจากแชทไปโผล่ที่ `/admin/cases`
- mode badge ใช้ `MODE_LABELS[mode] ?? mode` (`chat-header.tsx:72`) — ถ้าเพิ่ม mode ใหม่ใน `src/lib/line/chat-modes.ts` แต่ไม่เพิ่มใน `labels.ts` UI จะโชว์ snake_case แทนที่จะ error อย่าสับสนว่าข้อความพัง
