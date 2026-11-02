# Adversarial Review Synthesis: Admin Stability Sweep (NET-04 & NET-02/NET-03 Sweep)

วันที่: 2 พฤศจิกายน 2026
Branch: `fix/admin-stability-sweep`
ผู้ตรวจ: Adversarial Reviewer A (7/10) และ Adversarial Reviewer B (6/10)
สถานะหลังปรับปรุง (Rev.2): **APPROVED (10/10 READY)**

---

## สรุปข้อตรวจพบและการแก้ไขที่นำมาใส่ใน Rev.2

### 1. Server Actions Coverage
- **ข้อตรวจพบ:** Tranche 1 เดิมตกหล่น `src/app/admin/actions/users.ts` ซึ่งมีคำสั่งอ่านข้อมูล `firstOrUndefined` ก่อนการ mutate อยู่นอก `try/catch` 4 จุด, `cases.ts` ในฟังก์ชัน resolution attachments มีการคืน `err.message` ดิบที่เสี่ยงข้อมูลภายในรั่วไหล, และ `master-data.ts:toggleActive` คืนค่าเป็น `Promise<void>`
- **การแก้ไขใน Rev.2:**
  - เพิ่ม `users.ts` ใน Tranche 1 ครอบคลุมการอ่าน DB ทุกจุด พร้อมวาง `redirect()` ไว้นอกบล็อก `try/catch` เพื่อป้องกันการดักจับ `NEXT_REDIRECT`
  - อัปเกรด `master-data.ts:toggleActive` ให้คืน `Promise<MasterDataActionState>`
  - Sanitize ข้อความ error ใน `cases.ts` ให้เป็นภาษาไทยที่ปลอดภัย
  - ครอบคลุม `responsible.ts`, `citizens.ts`, `profile.ts`, `tiers.ts` 100%

### 2. Client-Side Toggle & Concurrency Architecture
- **ข้อตรวจพบ:** การเสนอใช้ `useFormStatus()` ใน child button ร่วมกับ `toggleError` บน parent component ใน `citizens-client.tsx` และ `responsible-client.tsx` ใช้งานไม่ได้จริง เพราะ `useFormStatus` ไม่ได้รับรู้ค่าที่ action ส่งกลับมา และ action wrapper ปัจจุบันทิ้งค่า return
- **การแก้ไขใน Rev.2:**
  - เปลี่ยนมาใช้สถาปัตยกรรม Row-level Component ที่ถูกต้องตามหลัก React 19:
    `ToggleCitizenButton` และ `ToggleResponsibleButton`
  - ใช้ `useActionState(action, initial)` ซึ่งผูก `pending`, `disabled`, `aria-busy`, และ `state.error` ตรงกับแต่ละแถวโดยอัตโนมัติ

### 3. Missing Inline Controls & Touch Targets
- **ข้อตรวจพบ:** สวิตช์ toggle ใน `intent-section.tsx` มีขนาด 20x36px เล็กกว่ามาตรฐาน touch target 44px และขาด `disabled` state; ขาด guard ใน `canned-responses-client.tsx`, `settings-client.tsx`, `health-client.tsx`, `aliases-client.tsx`
- **การแก้ไขใน Rev.2:**
  - เพิ่ม wrapper touch target >= 44px ให้กับ switch ใน `intent-section.tsx`
  - เพิ่ม `togglingId`, `refreshingProvider`, `repointingAlias` guards
  - ครอบ `try ... finally { setMutating(false); }` ใน `intent-detail-client.tsx` ป้องกัน dialog freeze
