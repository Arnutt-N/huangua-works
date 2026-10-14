# P2-06 — ตรวจและแก้ honeypot จาก commit 94707ec

## PRD

ปัญหา: error ของ honeypot ต่างจาก validation ปกติ ทำให้ผู้ส่งสแปมแยกสัญญาณได้; JSON null ทำให้ route อ่าน property แล้วล้ม; null ของ websiteUrl ไม่ตรงกับ contract ของ helper; ผู้ใช้จริงที่กรอกครบก่อน 2 วินาทีอาจถูกปฏิเสธ; ขาด tests ระดับ route และ client

ขอบเขต: anti-spam helper/tests, สัญญาณสองฟิลด์ใน validation, submit route/test, intake-form/test และแผนนี้ ไม่แก้ auth, การสร้างเคส, schema ฐานข้อมูล, rate-limit policy หรือ env ไม่เปลี่ยน field website_url/websiteUrl/formStartedAt และ MIN_SUBMIT_MS=2000

เกณฑ์รับ: malformed JSON/body, schema/CID validation และ honeypot ใช้ HTTP 400 + error กลางเดียวกัน ไม่บอกเหตุผลว่าเป็นบอท; rate-limit เดิมทำงานก่อนอ่าน body ทุกกรณี; whitespace มีค่าแล้วต้องปฏิเสธ, null/undefined websiteUrl เป็นว่าง; เวลา 0/ทศนิยมปฏิเสธผ่าน schema; future timestamp ไม่ใช้ตัดสินเวลาเพื่อคงเจตนาเดิมป้องกันนาฬิกา client เพี้ยน แต่ยังตรวจ honeypot และ rate-limit; ผู้ใช้กรอกช้าส่งได้ และผู้ใช้กรอกเร็วรอครบเกณฑ์โดยไม่แจ้ง error จาก client; timestamp ยึด mount เดิมไม่ reset เมื่อกรอกหรือ retry

ความเสี่ยง/ข้อจำกัด: timestamp เป็นสัญญาณจาก client ที่ปลอมได้และ optional เพื่อให้ client เก่าส่งได้ ไม่เปลี่ยนเป็นหลักฐานยืนยันตัวตน; future timestamp ไม่ใช่หลักฐานสแปมเพราะ clock skew; ไม่เพิ่มการเปิดเผยสัญญาณใน response; server rate-limit เดิมเป็น public fail-open ตามนโยบายระบบ ไม่มีการเปลี่ยน policy นอกงานนี้

ตัวชี้วัด: tsc/eslint ผ่าน, unit tests ที่ระบุผ่าน รวมกรณีขอบของข้อมูลและ quota โดยไม่ใช้ DB/Redis/API จริง ไม่มี console/debug ในไฟล์ที่แก้

## PRP-Plan

1. เพิ่มกรณีขอบใน src/lib/anti-spam.test.ts และเพิ่ม src/app/api/cases/submit/route.anti-spam.test.ts ใช้ mock enforceRateLimit, LIFF session และ createCase โดยใช้ schema จริง ตรวจ HTTP/body เทียบ spam กับ validation, quota 3 ครั้งแล้ว 429 และไม่ parse body เมื่อ quota เต็ม
2. แก้ src/lib/anti-spam.ts ให้ใช้เฉพาะ timestamp integer ที่ปลอดภัย; เปลี่ยนเฉพาะ websiteUrl ใน src/lib/validation.ts ให้รับ null เป็นค่าว่าง; ใน route ใช้ response กลางร่วมกัน, guard JSON shape ก่อนอ่านสัญญาณ, คง rate-limit ไว้ก่อนทุก early return ไม่แก้ business response
3. เพิ่ม src/app/intake/intake-form.anti-spam.test.tsx ใช้ LIFF/fetch mocks, ตรวจ hidden/offscreen/tab/ARIA และ payload/time ตั้งแต่ mount, ส่งช้า/เร็วและ retry ไม่ reset เวลา; แก้ intake-form.tsx เฉพาะ import constants, ARIA ของ honeypot และรอเวลาที่เหลือก่อน fetch พร้อมจับค่าสัญญาณ ณ ตอนกดส่ง
4. รัน npx tsc --noEmit, npx eslint ไฟล์ที่เปลี่ยน, npx vitest run เฉพาะสามไฟล์งานนี้ (contrast gate เรียกใน test งานนี้), ตรวจ debug/console และ git diff แล้ว commit เพิ่มบน feat/honeypot-anti-spam ไม่มี push/merge

ลำดับ: server tests → server implementation → client tests/implementation → gates/commit ไม่มี sub-agent

## Review gate

ตรวจ request กับ PRD และ source จริงแล้ว: rate-limit อยู่ก่อน anti-spam อยู่แล้ว จึงไม่ย้ายหรือเปลี่ยนนโยบาย; submitCaseLineSchema derives จาก submitCaseSchema จึงรับสัญญาณเดียวกัน; generic response ต้องแก้เฉพาะ submit route ไม่แก้ validateOrError ที่ใช้ทั่วระบบ; timer เดิมตั้งใน mount effect เพราะกฎ purity; input เดิม offscreen ไม่ใช้ display:none; กรณี future คง semantics ที่อธิบายไว้ใน helper ไม่เปลี่ยนเกณฑ์เพื่อกีดกันผู้ใช้จริง; เพิ่ม delay เฉพาะกรณีฟอร์ม valid และ elapsed น้อยกว่า 2000 ms

ใช้ karpathy-guidelines และ backend-patterns (ECC); อ่าน Next.js route handler/use-client guide ที่ติดตั้งแล้ว Graft ไม่มี graph จึงอ่าน source ตามที่ผู้ใช้ระบุ; ลบ BLOCKED.md เดิมตามคำสั่งแล้ว

## ผลตรวจรับใน worktree

- เพิ่มขอบเขตเวลารอ client ไม่เกิน 2000 ms เมื่อเวลาระบบถอยหลังระหว่างกรอก โดยไม่เปลี่ยนเกณฑ์ server
- npx tsc --noEmit ผ่าน (exit 0)
- npx eslint ทั้งเจ็ดไฟล์โค้ดที่แก้/เพิ่ม ผ่าน (exit 0)
- npx vitest run src/lib/anti-spam.test.ts src/app/api/cases/submit/route.anti-spam.test.ts src/app/intake/intake-form.anti-spam.test.tsx ผ่าน 61 tests (27 helper + 25 route + 9 client รวม contrast gate)
- tests จำลอง fetch และบริการ createCase/LIFF/rate-limit ไม่ยิง API, DB หรือ Redis จริง
- git diff --check ผ่าน; ไม่พบ console/debugger ในไฟล์โค้ดที่แก้; ไม่มี BLOCKED.md เดิมเหลืออยู่
- คงข้อจำกัดเดิม: timestamp เป็น heuristic จาก client ไม่ใช่หลักฐานป้องกันการปลอม และ rate-limit public คง fail-open เมื่อ Redis ล่ม
- ตรวจ diff แล้วไม่แก้ logic การสร้างเคส/auth หรือไฟล์ env; ไม่ push หรือ merge
