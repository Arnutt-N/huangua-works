# PRD — #143 T1 frontend-only (Consider non-blocking)

- Branch: `chore/143-consider-followup`
- Skills: karpathy-guidelines (baseline) · superpowers (process) · addyosmani (SDLC เล็ก)
- ต่อจาก #141 MERGED — เก็บเฉพาะข้อไม่แตะ server/schema/API

## ปัญหา

#143 เหลือ 18 ข้อ Consider จาก panel 4 โมเดล ฝั่ง frontend 11 ข้อทำได้เลยไม่เสี่ยง server: โค้ดซ้ำ 4 จุด, ป้ายหลอก 6 จุด, เทสขาด 1 จุด ข้อสเกล/API 6 ข้อ + failed timeline 1 ข้อต้องแตะ server แยก T2

## Scope

**In (11 ข้อ T1):**
1. alias CRUD ซ้ำ rich-menus-client + aliases-client → hook ร่วม
2. dashboard `listIntentsForReadiness` fetch เอง + `readinessOf` 3 สำเนา → reuse `listIntents` + สกัด `readinessOf` ไฟล์เดียว
3. `isUsableMenu` ไม่ตรง 2 ที่ → predicate เดียว
4. canned reload ลอก useEffect → รวมตัวเดียว
5. edit route ป้าย "แก้ไข" หลอก (PATCH รับแค่ display window) → ป้ายซิงก์/เผยแพร่
6. insights ป้าย "สถิติ" หลอก (ไม่มีตัวเลขจริง) → ป้ายสถานะเมนู
7. wizard ข้าม step + อดีตผ่าน + ปุ่มทดลองส่งสับสน → guard `buildContent` ก่อนออก step 1, บล็อกอดีต, ป้ายประเมินจำนวน
8. `toLocaleDateString` ใส่ hour/minute → เวลาหาย → `toLocaleString`
9. composer slash กลืนหาย + doubleClick จัดการ canned + retry → แจ้งเตือน/escape, ย้าย manage ขึ้นปุ่มชัด, ยืนยัน onRetry ต่อแล้ว
10. canned manage dialog error ใน dialog ที่ปิด → error ค้างนอกฟอร์ม + ยืนยัน confirm มีแล้ว
11. quick reply test เติมแถว 4+ / โฟกัส

**Out (T2 แยก issue):** toggle intent atomic, bulk serial/allSettled, pagination server chat-histories/broadcast, GET friends/:id, GET intents/:id, failed timeline `updatedAt`, baseline `control-has-associated-label` 5 หน้า, ขยะ untracked 36 ไฟล์

## Acceptance (ตรวจได้)

- `npx tsc --noEmit` เขียว, `npx eslint` ไม่เพิ่ม error ใหม่, `npx vitest run --exclude '**/*.integration.test.ts'` เขียว
- alias 2 หน้าใช้ hook เดียวกัน, `readinessOf` import จากไฟล์เดียว 3 ที่, `isUsableMenu` import เดียว 3 ที่
- ป้าย edit/insights ไม่หลอก, wizard อดีตบล็อก + ข้าม step ไม่ได้เมื่อ content ผิด, วันที่ broadcast มีเวลา, composer `/` ไม่กลืนหาย + ปุ่มจัดการชัด, dialog error เห็นหลังปิดฟอร์ม
- quick reply test ครอบแถว 4+

## ข้อจำกัด

- ห้ามแตะ `src/app/api/**`, schema, contract API เดิม
- UI/คอมเมนต์ไทย, `§` เดิมห้ามลบ, ฟังก์ชัน <50 บรรทัด, ไฟล์ <800 บรรทัด
- `pnpm` ค้าง ใช้ `npx` ทุกคำสั่ง

## สำเร็จ

- #143 ติ๊ก 11 ช่อง T1, T2 แยก follow-up, ไม่มี regression test เดิม
