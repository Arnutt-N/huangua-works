---
name: sync-jsk
description: ตรวจสอบการเปลี่ยนแปลงล่าสุดจากโปรเจค D:\genAI\jsk-app และพอร์ตฟีเจอร์ส่วนกลางที่เกี่ยวข้องเข้าสู่ huangua-works
---

# ทักษะการซิงค์โค้ดจาก JSK-App เข้าสู่ Huangua-Works (`sync-jsk`)

ใช้เมื่อผู้ใช้สั่งให้ตรวจสอบหรืออัปเดตโปรเจค `huangua-works` ตามการเปลี่ยนแปลงล่าสุดของ `D:\genAI\jsk-app`

## ขั้นตอนการปฏิบัติงาน

1. **รันสคริปต์ตรวจสอบความเปลี่ยนแปลง:**
   ```bash
   npx tsx scripts/check-jsk-sync.ts
   ```
2. **คัดกรองรายการที่ต้องพอร์ต (Filter & Triage):**
   - **พอร์ตเข้า `huangua-works`:** ระบบ LINE OA / Chatbot / Rich Menu / Broadcast, ระบบ Auth / สิทธิ์เจ้าหน้าที่ / Password Reset, คอมโพเนนต์ UI กลาง (เช่น `ThaiDatePicker`, Filter Bar, Dialog), ระบบ PDPA / Audit Log / Rate Limit
   - **ข้าม (ไม่พอร์ต):** ฟีเจอร์เฉพาะทางของ JSK ที่ไม่มีในอบต.หัวงัว (เช่น ระบบจองคิวคลินิก/Booking เฉพาะกิจ)
3. **ดำเนินการตามขั้นตอนใน `AGENTS.md`:**
   - สร้างกิ่งงานใหม่ (`git checkout -b feat/jsk-sync-YYYYMMDD`)
   - เขียน PRD + PRP-Plan ใน `docs/plans/`
   - พอร์ตโค้ดและชุดทดสอบ (แปลง Python backend ของ JSK ให้เป็น Next.js Route Handlers / Server Actions + Drizzle ORM ของหัวงัว)
4. **ตรวจสอบคุณภาพและบันทึกสถานะ:**
   - รัน `npx tsc --noEmit`, `npx eslint .`, `npx vitest run`, และ `graft build`
   - อัปเดตค่า `lastSyncedSessionFile`, `lastSyncedJskHead`, และ `lastSyncedAt` ใน `.agents/jsk-sync-state.json`
