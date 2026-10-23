# PRD — พอร์ตฟีเจอร์จาก JSK-App (21–23 ต.ค. 2026): โควต้า/สวิตช์แจ้งเตือน LINE + ปฏิทินเลือกวันที่แบบไทย (Thai Date-Picker) + ป้องกันการออก Token รีเซ็ตรหัสผ่านเมื่อส่งอีเมลไม่ได้

**Branch:** `feat/jsk-port-quota-datepicker`  
**Date:** 2026-10-23  
**Reference:** `D:\genAI\jsk-app\project-log-md\pi\session-summary-20261021-0603.md`, `0848.md`, `20261022-0818.md`, `20261023-0209.md`

---

## 1. Problem Statement / User Need

จากการเปรียบเทียบการเปลี่ยนแปลงล่าสุดของ `jsk-app` (PR #280–#287) กับระบบรับเรื่องร้องเรียน อบต.หัวงัว (`huangua-works`) พบช่องว่างสำคัญ 3 จุดที่ส่งผลต่อการปฏิบัติงานจริงของเจ้าหน้าที่:

1. **ผู้ดูแลระบบไม่เห็นโควต้าข้อความ LINE คงเหลือ และไม่มีสวิตช์เปิด-ปิดการส่งแจ้งเตือน LINE Push (จาก JSK PR #280, #281):**
   - ปัจจุบันหน้า `/admin/settings` แสดงเฉพาะว่าเชื่อมต่อ `LINE_CHANNEL_ACCESS_TOKEN` หรือยัง แต่ไม่แสดงจำนวนโควต้าข้อความ Push/Broadcast รายเดือนที่ใช้ไปและคงเหลือ (`โควต้า LINE คงเหลือ X / Y` หรือ `ไม่จำกัด`)
   - เมื่อมีฟีเจอร์ประกาศข่าวสาร (Broadcast) และการส่งข้อความแจ้งเตือน หากโควต้าใกล้เต็มกลางเดือน ผู้ดูแลระบบไม่สามารถตรวจสอบหรือสั่งปิดการส่งแจ้งเตือน LINE อัตโนมัติ (`line_notify_enabled`) ชั่วคราวจากหน้าเว็บได้
2. **หน้าจัดการเรื่องร้องเรียน (`/admin/reports`) และหน้าประวัติการกระทำ (`/admin/audit`) ยังไม่มีปฏิทินเลือกวันที่แบบไทย (Thai Date-Picker) สำหรับกรองตามช่วงเวลา (จาก JSK PR #285, #286, #287):**
   - เจ้าหน้าที่ไม่สามารถกรองดูเรื่องร้องเรียนหรือประวัติการใช้งานแบบระบุช่วงวันที่ (`ตั้งแต่วันที่` – `ถึงวันที่` ในรูปแบบ พ.ศ.) ได้
   - คอมโพเนนต์เลือกวันที่ต้องแสดงผลใน Portal เพื่อไม่ให้ถูกขอบการ์ด (`glass-panel overflow-hidden`) บังแหว่ง และต้องกดปุ่มล้างค่า (X) บนหน้าจอมือถือ (`pointer:coarse`) ได้สะดวกโดยไม่ทับปุ่มเปิดปฏิทิน
3. **ระบบรีเซ็ตรหัสผ่านออก Token และยกเลิกลิงก์เก่าแม้ในกรณีที่เซิร์ฟเวอร์ส่งอีเมลไม่ได้ (จาก JSK PR #284 - No mint when undeliverable):**
   - ใน `src/app/admin/actions/reset.ts` ปัจจุบันเรียก `createResetToken()` ก่อนตรวจสอบว่าระบบอีเมล (`isMailDeliverable()`) พร้อมส่งหรือไม่ ทำให้ลิงก์เก่าที่ยังใช้งานได้ถูกยกเลิกทันทีแม้เซิร์ฟเวอร์จะไม่ได้ตั้งค่า SMTP

---

## 2. Scope

### In Scope
- **Tranche 1 — LINE Quota Readout + LINE Push Notification Toggle (JSK PR #280, #281):**
  - เพิ่มฟังก์ชันดึงโควต้า LINE (`getLineQuota` เรียก `/v2/bot/message/quota` + `/v2/bot/message/quota/consumption`) ใน `src/lib/line/client.ts` พร้อมแคช 5 นาที, circuit breaker แยกเฉพาะ quota, และการป้องกันค่าติดลบ (clamp ≥ 0)
  - เพิ่มคีย์ตั้งค่า `line_notify_enabled` (boolean) ใน `src/lib/line/settings.ts` และ `PUT /api/line/admin/settings` พร้อมบันทึก Audit Log
  - เพิ่ม API `GET /api/line/admin/quota` (รองรับ `?refresh=1` เพื่อล้างแคชและดึงค่าสด)
  - แสดงสถานะโควต้า LINE คงเหลือ (`โควต้า LINE คงเหลือ X / Y` / `ไม่จำกัด` / ข้อความ fallback เมื่อดึงไม่สำเร็จ) พร้อมปุ่ม "รีเฟรชโควต้า" และสวิตช์ "เปิดการส่งแจ้งเตือนทาง LINE" ในหน้า `/admin/settings`
- **Tranche 2 — Password Reset Undeliverable Guard (JSK PR #284):**
  - เพิ่ม `isMailDeliverable()` ใน `src/lib/mail.ts` (`MAIL_CONSOLE === 'true' || Boolean(SMTP_HOST)`)
  - ใน `requestPasswordReset` (`src/app/admin/actions/reset.ts`) หาก `!isMailDeliverable()` ให้ข้ามการเรียก `createResetToken()` (ไม่สร้าง token ค้างและไม่เผาใบเก่าทิ้ง) บันทึก warn + audit `PASSWORD_RESET_FAILURE` (`reason: 'mail_not_configured'`) และคืนข้อความสำเร็จมาตรฐานเดิม (ป้องกัน enumeration)
- **Tranche 3 — Shared Thai Date-Picker (Portal + Touch Hardening) & Date Range Filters (JSK PR #285, #287):**
  - สร้างคอมโพเนนต์กลาง `ThaiDatePicker` (`src/components/ui/thai-date-picker.tsx`) ที่แสดงปี พ.ศ. ไทย เปิดป๊อปอัพผ่าน Portal (ไม่ถูก `overflow-hidden` ตัดขอบ) มีปุ่มล้างค่า (X) ขนาด ≥ 32px แยกชัดเจนสำหรับอุปกรณ์สัมผัส (`pointer:coarse`) และความกว้าง responsive (`w-full sm:w-52`)
  - เพิ่มตัวกรองช่วงวันที่ (`from` ตั้งแต่วันที่ / `to` ถึงวันที่) ใน `CaseFilterBar` (`/admin/reports`) และ `AuditFilterBar` (`/admin/audit`) พร้อมการกรองข้อมูลฝั่ง Server (เขตเวลา `Asia/Bangkok`)

### Out of Scope
- การล็อกอินด้วย Username (PR #283) และหน้าขอเปิดบัญชีสาธารณะ (PR #284 Public Access-Request) — แยกเป็นเฟสถัดไปหากผู้ดูแลระบบต้องการเปลี่ยนโครงสร้างตาราง `users`
- การแก้ไขโครงสร้างฐานข้อมูล (Schema Migration) — งานทั้ง 3 Tranche ใช้ตารางที่มีอยู่เดิมทั้งหมด (`chat_settings` เก็บเป็น key-value JSONB อยู่แล้ว)

---

## 3. Acceptance Criteria (Verifiable)

1. **LINE Quota & Toggle:**
   - `GET /api/line/admin/quota` คืนค่า `{ type: 'limited' | 'none', limit: number | null, used: number, remaining: number | null }` และแคชผลลัพธ์ 5 นาที (หากส่ง `?refresh=1` จะดึงข้อมูลใหม่จาก LINE API)
   - กรณี `used > limit` ค่า `remaining` ต้องถูกจำกัดไม่ให้ติดลบ (`Math.max(0, limit - used)`)
   - หน้า `/admin/settings` แสดงยอดโควต้าคงเหลือ ปุ่มกดรีเฟรช และสวิตช์เปิด-ปิด `line_notify_enabled` ซึ่งบันทึกผ่าน `PUT /api/line/admin/settings` พร้อมลง Audit Log
2. **Reset Token Undeliverable Guard:**
   - เมื่อไม่ได้ตั้งค่า `SMTP_HOST` และ `MAIL_CONSOLE !== 'true'` การเรียก `requestPasswordReset` จะไม่เรียก `createResetToken` และไม่ทำให้ token เดิมถูกยกเลิก แต่ยังคืน `{ error: null, success: true }` เหมือนเดิม
3. **Thai Date-Picker & Admin Filters:**
   - คอมโพเนนต์ `ThaiDatePicker` แสดงเดือนภาษาไทยและปี พ.ศ. (+543) ส่งค่าออกเป็นรูปแบบ `YYYY-MM-DD` (ค.ศ. มาตรฐานสำหรับ URL query param)
   - ป๊อปอัพปฏิทินเรนเดอร์ใน Portal ไม่อยู่ใต้ DOM ที่ถูก `overflow-hidden` ตัดขอบ
   - ปุ่มล้างค่า (X) กดล้างวันที่ได้ทั้งบน Desktop และ Touch device (`pointer:coarse`)
   - หน้า `/admin/reports` และ `/admin/audit` กรองข้อมูลตาม `?from=YYYY-MM-DD&to=YYYY-MM-DD` ได้ถูกต้องตามเวลาไทย (`+07:00`)
4. **Verification Gates:**
   - `npx tsc --noEmit` ผ่าน 0 errors
   - `npx eslint .` ผ่าน 0 warnings/errors
   - `npx vitest run` (รวมชุดทดสอบใหม่ของทั้ง 3 ส่วน และ contrast gate) ผ่านทั้งหมด

---

## 4. Constraints & Dependencies

- **ห้ามรัน `pnpm`:** ใช้ `npx` สำหรับทุกคำสั่งตามกฎใน `AGENTS.md`
- **ไม่ต้องเพิ่ม npm package ใหม่:** ใช้ `@radix-ui/react-dialog` / `@radix-ui/react-dropdown-menu` หรือ `createPortal` จาก `react-dom` ที่มีอยู่แล้วในโปรเจค
- **WCAG Contrast Gate:** ทุกสีที่ใช้ใน `ThaiDatePicker` และการ์ดโควต้า LINE ต้องใช้ Design Tokens จาก `src/styles/tokens.css` เท่านั้น

---

## 5. Success Metrics

- แอดมินตรวจสอบโควต้า LINE OA คงเหลือและเปิด/ปิดการแจ้งเตือนได้จากหน้า `/admin/settings` ภายในคลิกเดียว
- เจ้าหน้าที่ค้นหาเรื่องร้องเรียนและประวัติการใช้งานย้อนหลังตามช่วงวันที่ พ.ศ. ได้ทั้งบนคอมพิวเตอร์และโทรศัพท์มือถือ
- ชุดทดสอบ Unit Tests ใหม่ครอบคลุมทุกกรณีขอบเขต (Edge cases) และผ่านเกณฑ์ตรวจสอบ 100%
