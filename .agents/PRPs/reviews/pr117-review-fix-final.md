# ผลตรวจงานแก้ PR #117

วันที่ 16 ตุลาคม 2569. รับช่วงจาก `project-log-md/claude-code/handoff-2026-10-16T13-10-12+07-00.md` บน `fix/pr117-review-findings` จากฐาน `b0301ff`.

## ผลงาน

T1-T12 รับช่วงจาก working tree เดิมและตรวจด้วย full suite. T13 และ T14 มีโค้ดและ tests ครบแล้วตอนรับช่วง. T15 เพิ่ม assertions ปฏิเสธ base64 ที่ไม่ canonical และเปลี่ยนการเทียบเป็น bytes ของ base64 string โดยใช้ `timingSafeEqual` พร้อมตรวจความยาว.

แก้คอมเมนต์ใน `authorize-credentials.ts` ให้ตรงกับพฤติกรรมที่ DB/bcrypt errors ส่งต่อให้ Auth.js. ไม่เพิ่ม catch หรือเปลี่ยน error handling.

## หลักฐานการรัน

ใช้ Node เรียก CLI ภายใน `node_modules` โดยตรง ซึ่งเป็น binary เดียวกับ npx. Sandbox ปฏิเสธการ spawn ของ esbuild จึงรัน gates ด้วยสิทธิ์นอก sandbox.

| การตรวจ | ผล |
|---|---|
| `node node_modules/typescript/bin/tsc --noEmit` | exit 0 |
| `node node_modules/eslint/bin/eslint.js .` | exit 0, ไม่มี errors, warning `<img>` เดิม 3 จุดในไฟล์ที่ไม่ได้แก้ |
| lint เฉพาะ signature และ authorize-credentials หลังแก้ | exit 0 |
| T13/T14 ก่อนแก้ T15 | 17/17 ผ่าน |
| signature tests ก่อนแก้ | 4 failed, 10 passed. ทั้ง 4 เคสได้ true แทน false |
| T13 mutation `<=` เป็น `<` ชั่วคราว | 1 failed, 3 passed. เคสเวลาตรง expiry ได้ false แทน true. คืนต้นฉบับด้วย finally แล้ว |
| T13-T15 หลังแก้ | 31/31 ผ่าน |
| full suite แบบปกติ | 1169 ผ่าน, 5 timeout ใน intake tests 2 ไฟล์ |
| intake tests 2 ไฟล์ด้วย worker เดียว | anti-spam 9/9 ผ่าน. ฟอร์ม 4/5 ผ่านและมี async งานค้างหลัง teardown |
| intake form บน checkout แยกที่ `b0301ff` | 4/5 ผ่าน. เคสส่งสำเร็จหา heading ไม่ทันเหมือนกัน |
| `node node_modules/vitest/vitest.mjs run --maxWorkers=2` | **1174/1174 ผ่าน, 134 ไฟล์, exit 0** |
| `git diff --check` | exit 0 |
| Graft build ด้วย local CLI โดยตรง | exit 0. local cache ไม่เข้า commit |

Full suite ใช้ PostgreSQL, Redis และ Upstash REST proxy จาก Docker ของ repo. ไม่แก้ test timeout หรือข้าม integration tests.

Log ภายในเครื่องอยู่ที่ `.audit/pr117-full-vitest.log`, `.audit/pr117-full-vitest-limited.log` และ `.audit/pr117-baseline-intake.log`. เก็บเป็น local artifact.

## ข้อจำกัดที่ตรวจพบ

`intake-form.test.tsx:94` ใช้ findByRole รอ heading ด้วยเวลาปริยาย ขณะที่ `intake-form.tsx:274-275` รอเงื่อนไข anti-spam สูงสุด 2 วินาที. ผล test จึงขึ้นกับเวลาที่ใช้กรอกฟอร์ม. การรันบนฐานเดิมยืนยันว่าเกิดก่อนงานชุดนี้. ไม่แก้ tests หรือฟอร์มนอกขอบเขตแผน.

F17, F19 และ legacy dedup ยังคง deferred ตามแผน. ห้ามใช้วันที่โดยประมาณใน handoff เป็นหลักฐานว่าลบ legacy ได้ ต้องอิง deploy จริงและตรวจข้อมูลตามเงื่อนไขในโค้ด.

## รีวิว

G2 เดิมรอบแรก NOT READY 7/10 และรอบสอง READY 8/10 คงหลักฐานเดิมไว้ใน `plan_reviews/pr117-review-fix-review.md`.

Reviewer อิสระ `final_review` ให้ **PASS** จาก source review ของ findings ที่รับแก้ครบทุกข้อ รวม Auth.js ที่ติดตั้งจริง, tier fail closed, SSE teardown/watchdog, dedup integration, intake และ T13-T15. Reviewer ไม่ได้รัน tests เอง. ผู้รับช่วงเป็นผู้รัน gates ข้างต้น.

Reviewer คอมเมนต์พบข้อความคลาดเคลื่อน 1 จุดใน authorize-credentials และแก้แล้ว. ไม่พบ suppressions ใหม่. รักษา Thai § comments ตาม AGENTS.md.

Reviewer ของ audit trail ใช้ `gpt-6-sol` ตรวจ artifacts และ log summaries. ไม่มีพาธ runtime transcript ให้ตรวจ จึงเป็นการตรวจ artifacts เท่านั้น. ทั้งผู้ทำและผู้ตรวจอยู่ใน GPT family จึงไม่ครบเงื่อนไขต่าง family ของ show-me-your-work. ไม่มีผลแทนที่ source review หรือ gates. เพิ่ม checkpoint และระบุผลที่ root สังเกตเองตามข้อทักท้วงแล้ว.

ร่าง issue สำหรับ flaky test เก็บที่ `.audit/pr117-intake-issue.md`. Automatic approval review ปฏิเสธการสร้าง issue ภายนอกเพราะยังไม่มีคำอนุญาตเฉพาะเจาะจง. จึงยังไม่เผยแพร่ issue.

ยังไม่อนุมัติ merge. ต้องตรวจ Vercel preview ของ PR และได้รับ approval ก่อน merge ตาม AGENTS.md.
