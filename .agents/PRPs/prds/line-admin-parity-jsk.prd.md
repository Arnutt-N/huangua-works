# PRD — LINE admin parity JSK (ธีมหัวงัว โครง JSK)

- Branch: `feat/line-admin-parity-jsk`
- Skills: karpathy-guidelines (baseline) · superpowers (process) · mattpocock (thinking) · addyosmani (SDLC) · ui-skills (product UI)
- Source: โค้ด JSK `D:/genAI/jsk-app/frontend`, สกรีนชอต 15 ไฟล์ `secrets/jsk-app/screenshot/line/`, graft หัวงัว + JSK

## Problem statement

หน้า LINE admin หัวงัวมีฟีเจอร์ครบระดับ API (Application Programming Interface) แต่ UX (User Experience) ยังไม่เท่า JSK ที่โปรดักชันใช้จริง: broadcast ไม่มี detail/timeline, reply-objects เป็นตารางไม่ใช่กริดการ์ด, auto-replies ไม่มีหน้าลูก keywords/responses, rich-menus alias อยู่ใน modal, friends ไม่มี bulk/history, chat-histories ค้นหาไม่ group, `/admin/chat` ขาด picker/SessionActions/analytics

## ข้อตกลง (binding)

1. ธีม สี ตกแต่ง = หัวงัวหลัก (`AdminShell`, `AdminCard`, `tokens.css`, mesh-gradient, glass-panel)
2. องค์ประกอบ รูปแบบ โฟลว์ = JSK (stepper, กริดการ์ด, single-modal, badge, timeline, bulk)
3. ห้ามสร้าง `/admin/live-chat` ใหม่ — เสริม `/admin/chat` ในที่เดิม
4. reuse API `/api/line/admin/*` เดิม ไม่ย้าย backend JSK (FastAPI Python) มา
5. คง `requireStaff` roles + PDPA mask + audit ทุกจุด

## Scope

**In:** 9 หน้า LINE admin — chat, chat-histories, friends, chatbot dashboard, auto-replies, reply-objects, canned-responses, broadcast, rich-menus

**Out:** เปลี่ยน backend schema/API contract · ย้ายธีม JSK มา · แตะหน้ารับเรื่อง/เคส/รายงาน · เปลี่ยน auth/roles

## Acceptance criteria (ตรวจได้)

1. ทุกหน้ายังผ่าน `requireStaff` เดิม (chat ทุก staff, ที่เหลือ supervisor+) — test เดิมเขียว
2. `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` เขียว
3. ทุก mutation เขียน audit เดิม ไม่เพิ่ม endpoint ใหม่ถ้า API เดิมพอ
4. UI ไทยทั้งหน้า ข้อความคงคำเดิมจากสกรีนชอต (เช่น `ส่งข้อความแบบกระจาย`, `ยังไม่มีข้อความ Broadcast`)
5. ไม่มี `console.log`, ไม่มี secret หลุด client, PDPA mask `U*...` ทุกจุดแสดง LINE ID
