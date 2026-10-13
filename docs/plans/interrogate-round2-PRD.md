# PRD: แก้ Act On รอบสอง (7 ข้อ, ของที่ #113 ยังเหลือ)

ต่อจาก verdict interrogate รอบสอง (A–D) — งานนี้ทำเฉพาะ Act On ที่ยังเหลือ
(end-only publish, 409 เหมารวม, normalize, stale rows ทำไปแล้วใน #113 ไม่ทำซ้ำ)
branch `fix/interrogate-round2` (worktree `D:/toppublic/fix-r2-acton`)

## ปัญหา (มี trace ครบทุกข้อ)

1. อ่าน default ล้มแล้ว tick ยัง flip expire → default ค้างถาวรแบบเงียบ
   (`runDisplayTick`: read ล้มได้ `currentDefault=null` แต่ expire loop เดินต่อ)
2. Winner ชนะแค่ tick เดียว — tick หน้าเลือกจากที่เหลือไม่นับตัว active อยู่
   default เดินถอยหลัง แถว active ค้างหลายตัว
3. ชดเชย alias ลบของคนอื่น — `deleteAliasOnLine(aliasId)` ไม่เช็คเจ้าของ
   ชน concurrent winner พัง mapping เขา
4. PATCH ตรวจแค่คู่ที่ส่งมา — ส่งข้างเดียวกับของเก่าที่เก็บไว้รวมกันกลับหัวได้
   tick ไม่แตะแถวนั้นอีกเลย
5. TierMatrixCard ไม่มี key จริง — comment อ้าง key ที่ไม่มี save สองครั้งทับกันเงียบ
6. DELETE เมนูลบแค่แถว DB — ลบ default สดทิ้ง default ค้าง + orphan บน LINE +
   alias แทรกกลางทางได้ 500 ดิบ (FK RESTRICT)
7. Crash กลางสร้าง alias กู้ไม่ได้ — retry ชน 4xx ตลอด ไม่มี reconcile

## ขอบเขต

**ในขอบเขต (G1–G4):**
- G1 tick รอบสอง (`rich-menu-service.ts`): read default ล้ม → ข้าม expire ทั้งหมด
  (defer แบบ cancel-fail); election ข้าม `active ∪ contenders` เลือก start ล่าสุด
  activate เฉพาะเมื่อ winner ยังไม่ active; demote ตัวอื่นเป็น inactive ใน tick เดียวกัน
- G2 alias race (`rich-menu-service.ts` + `client.ts`): ชดเชยเฉพาะเมื่อ LINE alias
  ชี้เป้าเดียวกับที่ call นี้สร้าง (อ่านกลับก่อนลบ); เพิ่ม `getAliasOnLine`
  (GET alias); สร้างชน 4xx → ถ้าเป้าตรงเขียนแถวคืน (reconcile) ไม่ใช่ error ดิบ
- G3 menu routes (`rich-menus/[id]/route.ts`): PATCH อ่านแถวก่อน รวมคู่แล้ว validate;
  `{}` เปล่า → 400; DELETE กัน `status=active`/เป็น default ปัจจุบัน (409),
  ลบ remote แบบ best-effort ก่อนลบแถว, try/catch แมป FK เป็น 409 (ordering นี้ PRD อนุมัติแล้ว — ปิดประเด็น B4)
- G4 tier key (`users-client.tsx`): `key={JSON.stringify(tierMatrix)}` ตรงจุดใช้
  (ตาม comment ที่สัญญาไว้)

**นอกขอบเขต:**
- #110 rebase/clamp — ของ session อื่น ได้แค่ทัก (บันทึกไว้แล้วใน verdict)
- Oracle/se rejected/CSAT reader — ตัดสินแล้วรอบก่อน ไม่รื้อ

## เกณฑ์ยอมรับ (ตรวจได้)

- G1: test หลาย tick (plan→apply→replan) default อยู่ตัวล่าสุดตัวเดียว แถว active ตัวเดียว;
  read ล้ม → expire ไม่ขยับ + error ออก 502
- G2: test ชดเชยชน winner (mock LINE alias ชี้เป้าอื่น → ไม่ลบ);
  สร้างชน 4xx เป้าตรง → ได้แถวคืน + ok
- G3: PATCH ข้างเดียวกลับหัว → 400; PATCH ว่าง → 400; DELETE default สด → 409;
  DELETE ติด alias กลางทาง → 409 ไม่ใช่ 500
- G4: tsc + eslint (พฤติกรรม UI เปลี่ยน key อย่างเดียว ไม่มี test component ใน repo)

## ข้อจำกัด

- กฎ `AGENTS.md` เดิม (TDD, gates, conventional commits, `npx`)
- ไม่แตะ branch/file ของ session อื่น; ทดสอบชน race ด้วย mock เท่านั้น (ไม่ยิง LINE จริง)

## ตัวชี้วัด

- test ใหม่ทุกข้อเขียว + tsc + eslint + ไม่มี test เก่าแดงเพราะงานนี้
