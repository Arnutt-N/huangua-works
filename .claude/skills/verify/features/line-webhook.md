# LINE chatbot webhook

Bot ตอบ LINE OA จาก event ที่ LINE Platform ยิงมาที่ `/api/line/webhook` — ตรวจ `X-Line-Signature` (HMAC-SHA256 ของ body ด้วย `LINE_CHANNEL_SECRET`) แล้วส่งต่อให้ bot engine แปลความหมายของข้อความ ตอบ FAQ / เริ่ม case-flow / หรือส่งต่อเจ้าหน้าที่ `scripts/test-webhook.ts` ยิง event จำลองที่มี signature ถูกต้องเข้า webhook จริง ทำให้ verify ได้ทั้ง signature check และ bot engine โดยไม่ต้องมี LINE Console

## Sub-features

- `webhook-follow` event ติดตาม OA ใหม่ → welcome reply
- `webhook-message` event ข้อความ `แจ้งเรื่อง` → bot intent match / FAQ
- `webhook-handoff` event `ติดต่อเจ้าหน้าที่` → สถานะ `waiting_handoff` + แจ้งเตือนเจ้าหน้าที่
- `webhook-signature` event ที่ไม่มี header `x-line-signature` หรือ signature ผิด → 401 ก่อน parse body ก่อนลง engine (`/api/line/webhook` route ตรวจ signature ก่อน `JSON.parse`)

## How to get to it (user POV)

- ผู้ใช้พิมพ์ "แจ้งเรื่อง" หรือ "ติดต่อเจ้าหน้าที่" ใน LINE OA (ของจริง)
- ใน local: `npx tsx scripts/test-webhook.ts <follow|message|handoff>`
- BASE ปกติ `http://localhost:3000` — script รับ arg ที่ 2 ถ้าจะชี้อื่น:
  `npx tsx scripts/test-webhook.ts http://localhost:3001 follow`

Login: ไม่มี — path นี้ยืนยันด้วย signature ไม่ใช่ session

## Driving it with curl

Preconditions:

- dev server รันอยู่ และ `/api/line/webhook` ตอบ (ไม่ต้อง 200 — 401/400 ก็พิสูจน์ได้ว่า signature gate ทำงาน)
- `LINE_CHANNEL_SECRET` ตั้งใน `.env.local` (script อ่านจากนั้น)
- Redis/DB ขึ้นอยู่ กับ event type (handoff ต้องเขียน DB + แจ้ง SSE)

- **follow event (welcome).** `npx tsx scripts/test-webhook.ts http://localhost:3000 follow`. stdout แสดง HTTP status และสรุปว่า webhook รับ + ตอบ welcome สำเร็จ
- **message event (intent).** `npx tsx scripts/test-webhook.ts http://localhost:3000 message`. bot engine แปลความหมายข้อความ "แจ้งเรื่อง" แล้วตอบตาม intent/FAQ
- **handoff event.** `npx tsx scripts/test-webhook.ts http://localhost:3000 handoff`. stdout ยืนยันว่าเคส/บทสนทนาถูกสร้างหรือส่งต่อ
- **proof (DB).** ค้น row ที่พึ่งสร้าง: `chat_conversations` ที่มี `line_user_id = 'U_test_local_webhook_user'` และ `line_users` ชื่อเดียวกัน — อ่านเป็น view ที่สองยืนยันว่า bot engine ลง DB จริง ไม่ใช่แค่ตอบ LINE `chat_messages` (`sender = 'bot'`, `messageType` = `text`/`flex`) เป็น evidence เพิ่ม — รัน `npx tsx scripts/check-line-db.ts` ได้
- **signature gate — ไม่มี signature.** ไม่ส่ง header `x-line-signature`:
  `curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/line/webhook -H 'Content-Type: application/json' -d '{}'`
  ต้องได้ `401` — `verifyLineSignature` คืน false เมื่อ header หาย (`src/lib/line/signature.ts:5`)
- **signature gate — signature ผิด.** ส่ง header มั่ว:
  `curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/line/webhook -H 'Content-Type: application/json' -H 'x-line-signature: ZmFrZQ==' -d '{}'`
  ต้องได้ `401`
- **SSE (ถ้าทดสอบ handoff).** เปิด `/admin/chat` หลัง login แล้วดูบทสนทนาใหม่ปรากฏแบบไม่ต้อง refresh (`EventSource('/api/line/admin/sse')` — ต้อง login staff)

## Gotchas

- `LINE_CHANNEL_SECRET` ไม่ได้ตั้งใน `.env.local` → `scripts/test-webhook.ts` ออกทันทีด้วยข้อความ `LINE_CHANNEL_SECRET ไม่ได้ตั้งใน .env.local` (exit 1) และ signature gate ตอบ 401 ทุก request — บนเครื่องที่ไม่มี secret จริง การยืนยัน bot engine เลยทำไม่ได้ ค่านี้ไม่อยู่ใน `verify-env` ที่บังคับ build จึงดูเหมือน "บอทเงียบ" เงียบ ๆ
- **argv ของ test-webhook พลิกกับที่ intuition คิด:** `argv[2]` = BASE URL, `argv[3]` = event type (`scripts/test-webhook.ts:21-22`) คำสั่งสั้น `npx tsx scripts/test-webhook.ts handoff` จะพัง เพราะ BASE กลายเป็น `follow`/`handoff` (invalid URL) ต้องเขียน BASE เสมอ — default ของ script คือ `:3001` ซึ่งไม่มีอะไรรันอยู่ ต้องบังคับ `http://localhost:3000`
- `curl -d '{}'` ที่ส่ง signature ถูกต้องไม่ได้พิสูจน์ gate — secret ตรงแล้ว body `{}` ไม่มี `events` → `parsed.events.map` throw → Next ตอบ **500** ไม่ได้ 200 ยืนยัน gate ด้วย (ก) ไม่ส่ง header (401) หรือ (ข) ส่ง header มั่ว (401)
- **webhook ไม่มี rate limit ของตัวเอง** — ไม่มี policy key สำหรับ webhook เลย Redis ถูกใช้แค่ dedup `webhook:event:<id>` (TTL 300s, fail-open เมื่อ Redis ล่ม) ไม่มีทางได้ 429 จาก webhook นี้เอง
- script ไม่ส่ง `webhookEventId` (field ไม่มีใน payload) → `isDuplicateEvent` คืน false เสมอ → ทุกครั้งที่รันสร้าง row ใหม่ ไม่มี dedup ป้องกันซ้ำ
- `bot_enabled = false` → route ข้อความใหม่ทั้งหมดไปเจ้าหน้าที่ด้วยสถานะ `waiting_handoff` + ตอบข้อความเดียว (ไม่ใช่ flex+text แบบ handoff ปกติ) ถ้า bot ไม่ตอบแม้ควรตอบ เช็กค่านี้ผ่าน `/admin/chatbot` ก่อนสงสัยโค้ด
- `business_hours` ผิดรูปแบบใน DB (`days` ไม่ใช่ array, `hours` null/เสีย) → `isWithinBusinessHours` คืน **true** = handoff ได้เสมอ (fail-open) อย่าสรุปว่าทำงานถูกเพราะ handoff ตอบ — เช็กค่าใน DB ด้วย
- ข้อความนอกเวลาทำการขึ้นต้น `ขณะนี้อยู่นอกเวลาทำการของเจ้าหน้าที่` (ไม่มีคำว่า "ราชการ") — ถ้าเทียบข้อความต้องใช้ string นี้ ไม่มี "นอกจากเวลาราชการ" ในโค้ด
- สคริปต์ทดสอบสร้าง `U_test_local_webhook_user` จริงใน DB (ทั้ง `line_users`, `chat_conversations`, `chat_messages`) — ไม่มี afterAll ให้ ถ้าอยากลบ ดับเบิลเอง หรือรัน `npx tsx scripts/check-line-db.ts` เพื่อดูก่อน
- อย่าอ้าง table `conversations` — ชื่อจริงคือ `chat_conversations` (`src/lib/db/schema.ts:488`)
