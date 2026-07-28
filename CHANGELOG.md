# Changelog

การเปลี่ยนแปลงสำคัญของ huangua-works — เรียงจากใหม่ไปเก่า (รูปแบบตาม [Keep a Changelog](https://keepachangelog.com/en/1.1.0/))
รายละเอียดเชิงเทคนิคเต็มอยู่ใน git history และ PR ที่อ้างอิง; ก่อนหน้านี้ไม่มี changelog — ดูประวัติจาก `git log` / merged PRs

## [2026-07-28] — Admin login UX + session persistence ([PR #37](https://github.com/Arnutt-N/huangua-works/pull/37))

### Changed

- **Login spinner ย้ายเข้าไปในปุ่ม submit** — กด "เข้าระบบ" แล้วปุ่มแสดง spinner + "กำลังเข้าระบบ..." จนกว่าจะ redirect ไป `/admin` โดยตรง เลิกแสดงการ์ด spinner แทนที่ทั้งฟอร์ม (feedback อยู่ที่ปุ่มตาม best practice)
- **"จดจำฉัน" ติ๊กเป็นค่าเริ่มต้น** — เจ้าหน้าที่ login แล้วอยู่ยาว 30 วันทันที; เอาติ๊กออกได้สำหรับเครื่องสาธารณะ (session เหลือ 1 ชั่วโมง)

### Fixed

- อาการ "remember me แต่ไม่ keep me" — ก่อนหน้านี้ checkbox ไม่ติ๊กมา ทำให้ session หมดอายุใน 1 ชม. (JWT `expiresAt` claim) ทั้งที่ cookie อายุ 30 วัน ผู้ใช้จึงถูกเตะออกเร็วเกินคาด
- กัน React 19 reset ช่องกรอกว่างวูบระหว่างรอ redirect หลัง login สำเร็จ (input เป็น controlled)

### Added

- E2E test ถอดรหัส session JWT ยันอายุ session จริง: ~30 วันเมื่อติ๊ก "จดจำฉัน" vs ~1 ชั่วโมงเมื่อไม่ติ๊ก + ยัน checkbox ติ๊กเป็นค่าเริ่มต้น (`e2e/admin-auth.spec.ts`)
