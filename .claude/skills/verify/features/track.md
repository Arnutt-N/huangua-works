# ค้นหาและติดตามเรื่อง (track)

ผู้ใช้อยากตามสถานะเรื่องที่แจ้งไปแล้ว โดยนำเลขติดตาม (`HG…`/`HN…`) มากรอกที่ `/track` — ระบบค้นแถว `cases` แล้วแสดงหัวเรื่อง + status badge + timeline จาก `caseUpdates.isPublic = true` ถ้าเข้ามาผ่าน LINE จะเห็น "เรื่องของฉัน" (รายการเคสของตัวเอง) ได้ทันทีโดยไม่ต้องพิมพ์เลข (แสดงเฉพาะเมื่อมีเคส — `myCases.length > 0`)

## Sub-features

- `track-query` ค้นด้วยเลขติดตาม → แสดงหัวเรื่อง สถานะ
- `track-autoload` เปิด `/track?id=<code>` → โหลดเคสนั้นให้อัตโนมัติ
- `track-notfound` เลขที่ไม่มีในระบบ → ข้อความ `ไม่พบเรื่องนี้`
- `track-empty` กดค้นหาโดยไม่กรอก → บล็อก client-side ไม่ยิง network
- `track-my-cases` ผ่าน LIFF session → section "เรื่องของฉัน" แสดงลิสต์เคสตัวเอง
- `track-web-no-session` เข้า `/track` แบบเว็บธรรมดา → ไม่มี section "เรื่องของฉัน"

## How to get to it (user POV)

- เปิด `http://localhost:3000/track` แล้วกรอกเลขติดตามในช่อง `เลขติดตามเรื่อง` แล้วกด `ค้นหาเรื่อง`
- คลิกลิงก์ `ติดตามเรื่องนี้` จากหน้า "รับเรื่องเรียบร้อย" หลังส่งที่ `/intake`
- เปิด `/track?liffmock=<LINE_USER_ID>` เพื่อจำลอง session LINE (ต้องรัน dev ด้วย `LIFF_E2E_MOCK=1`)

## Driving it with Playwright

Preconditions:

- dev server ตอบ 200 ที่ `/track`
- `e2e/track.spec.ts` แทรก user + consent record + case (`trackingCode = 'HN888888881'`) เองใน `beforeAll` และลบเองใน `afterAll` — ไม่ใช่ seed script ไม่ต้องเตรียมดมือ
- `e2e/track-liff.spec.ts` เพิ่ม `line_users` row (`lineUserId = 'Ue2eliffmock02'` ผูกกับ user) + consent `data_collection` version `1.1` + case ตัวเอง แล้วลบใน `afterAll`

- **ค้นหาด้วยมือ.** `page.goto('/track')`, `page.getByLabel('เลขติดตามเรื่อง').fill('<code>')`, `page.getByRole('button', { name: 'ค้นหาเรื่อง' }).click()`. หัวเรื่องของเคสนั้นปรากฏ
- **auto-load ผ่าน query.** `page.goto('/track?id=<code>')`. หัวเรื่องของเคสนั้นปรากฏเองไม่ต้องกรอก
- **เลขไม่มีในระบบ.** กรอก `HN000000000` แล้วกดค้นหา. ข้อความ `ไม่พบเรื่องนี้` ปรากฏ และไม่มี stack trace
- **ค้นหาเปล่า.** `page.goto('/track')`, `page.waitForLoadState('networkidle')` แล้วกด `ค้นหาเรื่อง` ทั้งที่ช่องว่าง. ข้อความ `กรุณากรอกเลขติดตามเรื่อง` ปรากฏ และไม่มี request ออกไปนอก

- **เรื่องของฉัน (LIFF).** `page.goto('/track?liffmock=<LINE_USER_ID>')`. heading `เรื่องของฉัน` ปรากฏ และ `page.getByTestId('my-cases-list')` มีข้อความ tracking code + หัวเรื่องของเคสที่ seed ไว้

- **เว็บแบบไม่มี session.** เปิด context/page ใหม่แล้ว `page.goto('/track')`. heading `เรื่องของฉัน` **ไม่** ปรากฏ และช่อง `เลขติดตามเรื่อง` ปรากฏตามปกติ

- **proof.** screenshot หน้า track ที่แสดงสถานะเคส + **และ** ค้นแถวใน DB ด้วย `tracking_code` เพื่อยืนยันว่าเลขที่กรอกคือเลขที่ส่งจริง (ไม่ใช่เลข mock บนหน้าจอ)

## Gotchas

- route `/track` compile สดครั้งแรกบน dev ช้ามาก — ตั้ง timeout 40_000 สำหรับ test ที่โหลด `/track` หรือ `/api/cases/[id]` เป็นครั้งแรก
- tracking code = `(HN|HG)` + ตัวเลข 9 หลัก รวม 11 ตัว (`src/lib/case-tracking.ts:45`) — สร้างใหม่ทุกเรื่องเป็น prefix `HG` ส่วน `HN` เป็น legacy ที่ค้นได้อยู่
- `GET /api/cases/[id]` มี rate limit `track` 10 ครั้ง/5 นาทีต่อ IP (`failOpen: false`) — ถ้าค้นซ้ำภายใน 5 นาทีจะได้ 429 ข้อความ `ค้นหาถี่เกินไป กรุณารอ N วินาที` ไม่ใช่ `ไม่พบเรื่องนี้` อย่าอ่านว่าเคสหาย
- visibility กติกาเดียวทุกช่องทาง: consent `data_collection` ล่าสุดต้อง `isGranted = true` — **ไม่เช็ก version** (`consent-policy.ts:51-60`) ถ้า "เรื่องของฉัน" ว่างทั้งเคสมี แสดงว่าไม่มี consent เรียงล่าสุด หรือ `line_users.linkedUserId` ไม่ได้ผูกกับ `cases.submittedBy`
- `track-liff.spec.ts` reset rate-limit `liffSession` ใน `beforeAll` เท่านั้น (ต่างจาก `intake-liff.spec.ts` ที่ reset `beforeEach`) — เพิ่ม test ที่โหลด LIFF ไปเอง ระวัง 429 เพราะ `next dev` 16.3.8 ยิง GET+POST คู่ซ้ำต่อการโหลดหน้า
- click `ค้นหาเรื่อง` ก่อน client hydrate จะตกที่ native form submit (reload หน้า) แทน React handler — รอ `networkidle` ก่อน
- LIFF mock ต้องตั้ง `LIFF_E2E_MOCK=1` ตอนรัน dev server ด้วย ไม่งั้น `POST /api/liff/session` ปฏิเสธ token จำลอง และ spec ทั้งไฟล์ถูกละ
- section "เรื่องของฉัน" แสดงเฉพาะเมื่อมีเคส (`myCases.length > 0`) — หน้าเปล่าไม่ใช่ความผิดพลาด อย่าใช้การไม่มี section เป็นหลักฐานว่า LIFF ไม่ทำงาน ถ้าจะเช็ก "ไม่มี section" ให้ใช้ fresh context ที่ไม่เคยมี LIFF session
