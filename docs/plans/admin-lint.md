# แก้ lint ในหน้า admin

## PRD

หน้า admin มี JSX quotes ที่ไม่ escape และ lint รายงาน controls ที่ไม่มีชื่อใน attributes ของ control ทำให้ lint ของ repo ไม่ผ่าน บาง controls มีชื่อใน browser จาก label เดิมอยู่แล้ว แต่ rule นี้ยังรายงาน error เป้าหมายคือให้ `npx eslint .` exit 0 พร้อมคงการทำงานของฟอร์มและข้อความที่ผู้ใช้เห็น

ขอบเขตคือหก client components ที่รายงาน lint ระบุ ไม่แก้ handlers, state, API, auth, shared hooks, layout หรือพฤติกรรมรูปภาพ ไม่เพิ่ม dependency และไม่ปิด lint rules คำเตือนรูปภาพเดิมอาจยังอยู่ได้หาก lint exit 0

เกณฑ์รับงาน:

- `npx eslint .` exit 0 และไม่มี errors
- `npx tsc --noEmit` และ `npx vitest run` ผ่าน
- JSX entities แสดงเครื่องหมายคำพูดและข้อความเหมือนเดิม
- input controls ที่แก้มี accessible name ภาษาไทยตรงกับหน้าที่จริง โดยคง type, value, onChange และ constraints เดิม canvas สำหรับวาดรูปที่ซ่อนอยู่ระบุ aria-hidden อย่างชัดเจน
- WIP เดิมไม่ถูกแก้ ทับ หรือรวมเข้า commit งานนี้
- ไม่ push, เปิด PR หรือ merge

ใช้ rules ที่เปิดอยู่ใน ESLint เป็นตัวตรวจ ไม่เพิ่ม tests ที่ยืนยันเพียงรูปแบบ implementation มี baseline และผลตรวจจริงก่อนและหลัง

## PRP-Plan

1. รัน lint baseline ใน workspace หลัก บันทึก WIP และใช้ graft หา context ก่อนอ่าน source
2. ตรวจ JSX และ controls ที่ระบุกับโค้ดจริง Review PRD และแผนก่อนโค้ด ใช้ aria-label ภาษาไทยตรงกับ label เดิมสำหรับ controls ที่มี label association อยู่แล้ว แต่ rule ยังรายงาน error สำหรับ hidden file inputs ใช้ชื่อภาษาไทยตรงกับหน้าที่ และ hidden canvas ใช้ aria-hidden="true"
3. ให้ผู้แก้คนเดียวใน worktree แยกแก้เฉพาะไฟล์ต่อไปนี้:
   - `src/app/admin/chatbot/auto-replies/auto-replies-client.tsx`
   - `src/app/admin/chatbot/broadcast/broadcast-client.tsx`
   - `src/app/admin/chatbot/reply-objects/reply-objects-client.tsx`
   - `src/app/admin/chatbot/rich-menus/rich-menus-client.tsx`
   - `src/app/admin/files/files-client.tsx`
   - `src/app/admin/image-resize/image-resize-client.tsx`
4. Escape เฉพาะ quotes ใน JSX text เป็น `&quot;` ซึ่ง browser decode กลับเป็นเครื่องหมายเดิม และเชื่อมชื่อ controls ตามผลสำรวจ ไม่เปลี่ยน handler หรือ function signature
5. ตรวจ scoped lint และ diff ก่อนนำหกไฟล์กลับ workspace หลัก หลังผู้แก้หยุดแล้ว รัน full lint, typecheck และ tests กับ WIP ปัจจุบัน
6. ให้ reviewer อิสระตรวจว่า delta มีเพียง entities และ accessible names ทบทวน comments ตาม no-comments โดยรักษา § เดิม จากนั้น commit เฉพาะไฟล์งานนี้กับแผนแบบ conventional commit

ลำดับที่บล็อกคือ baseline และ review gate ก่อนโค้ด มีผู้แก้หนึ่งคนเพราะ patch เป็นชุดเล็กและไม่ต้องแบ่งส่วนที่เขียน state ร่วมกัน ผู้อ่านและ reviewer ตรวจได้แบบอ่านอย่างเดียว

ความเสี่ยงคือชื่อ accessible name ไม่ตรงกับ visible label และเผลอรวม WIP เดิม Mitigation คือใช้ข้อความ label เดิม เทียบ source หลังถอดเฉพาะ attributes ที่เพิ่มและ decode quotes ให้ตรงกับต้นฉบับ และ stage ด้วยชื่อไฟล์ที่อนุญาตเท่านั้น

## Review gate

รูปแบบข้อมูลคือ form state และ native controls ที่มีอยู่แล้ว ปรับเฉพาะข้อความ JSX และ label attributes ไม่มี API หรือชนิดข้อมูลใหม่ ไม่ต้องใช้ architect เพราะไม่ได้เปลี่ยน signature หรือข้าม function boundary ผล baseline และผู้สำรวจยืนยัน scope กับ source ก่อน implementation

ผู้สำรวจอิสระตรวจ source กับ rule ที่ติดตั้งแล้วให้ READY หลังแก้ข้อเท็จจริงเรื่อง label ที่มีอยู่แล้วและ hidden canvas ตามผลจริง ผ่าน review gate ก่อน implementation

## สาเหตุที่ยืนยันจาก source

- `auto-replies` และ `reply-objects` มี checkbox อยู่ใน label ข้อความ `ใช้งาน` แล้ว ให้ aria-label ตรงกับคำนี้
- `broadcast` มี `Label htmlFor="bc-schedule"` กับ input id เดิมแล้ว ให้ aria-label ตรงกับข้อความ `ตั้งเวลาส่ง (เว้นว่าง = สร้างเป็นร่าง)`
- File inputs ที่ซ่อนใน files และ image-resize ไม่มีชื่อระดับ attribute ที่ rule ยอมรับ ให้ชื่อตามหน้าที่ ไม่เปลี่ยน ref, hidden หรือ onChange ส่วน hidden canvas เป็นรายละเอียดการวาดภาพภายใน จึงระบุ aria-hidden="true"
- JSX text มีเครื่องหมายคำพูดที่ต้อง escape สี่บรรทัด รวมแปดอักขระ
- Baseline `npx eslint .` exit 1 รายงาน `14 errors, 3 warnings` warnings ทั้งสามเป็น `@next/next/no-img-element` ที่อยู่นอกขอบเขตแก้ errors

## ผลตรวจจริง

- `npx eslint .` รอบสุดท้าย exit 0: 0 errors และ 3 warnings รูปภาพเดิม
- `npx tsc --noEmit` exit 0
- `npx vitest run` exit 0: 76 files และ 711 tests ผ่านทั้งหมด รวม integration tests กับ Docker stack
- Scoped `git diff --check` ผ่าน และการเทียบ source หลังถอดเฉพาะ edits ที่อนุมัติออกตรงกับ HEAD ทั้งหกไฟล์
- Reviewer อิสระให้ READY; no-comments ลบ 0 ไม่มี findings และ deslop ไม่พบโค้ดเพิ่มเติมนอกขอบเขต
- SHA256 ของ WIP เดิมทั้งห้าไฟล์ไม่เปลี่ยน ทั้ง workspace มี whitespace เดิมใน `next-env.d.ts` จึงไม่แก้และไม่ stage ไฟล์นั้น
- Commit เฉพาะหก source files กับแผนนี้ใน branch `fix/admin-lint` ไม่ push, เปิด PR หรือ merge
