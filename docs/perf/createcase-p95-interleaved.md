# p95 createCase() — เปรียบเทียบก่อน/หลัง PR-B แบบสลับฝั่ง

วันที่ 26 พฤศจิกายน 2569 วัดบน Postgres จริงที่ `127.0.0.1:5433` เครื่อง 12 cores

สคริปต์: `C:/Users/arnutt.n/AppData/Local/Temp/opencode/p95-alternating.ts` รันจาก baseline worktree `deef129` (ก่อน PR-B) และ worktree ปัจจุบัน `665c29b` (หลัง PR-B รวม follow-up ถึง #235) สลับลำดับ base → current รวม 5 คู่

ตั้ง `NODE_ENV=test` เพื่อข้าม notification ทั้งสองฝั่ง วัดเฉพาะ `createCase()` กับ DB ทุก call ใช้ CID ไม่ซ้ำ ตรวจว่ามีแถวใน `cases` จริง เก็บ p95 ต่อรอบจาก 20 sequential calls และลบ fixture หลังรอบ ผลทั้งหมด errors = 0

| คู่ | p95 ก่อน PR-B | p95 หลัง PR-B | ผลต่าง (ก่อน − หลัง) |
|---:|---:|---:|---:|
| 1 | 209.3 ms | 173.1 ms | +36.2 ms |
| 2 | 244.2 ms | 194.9 ms | +49.3 ms |
| 3 | 169.5 ms | 281.8 ms | −112.3 ms |
| 4 | 218.0 ms | 130.9 ms | +87.1 ms |
| 5 | 125.2 ms | 179.8 ms | −54.6 ms |

สรุป: p95 ก่อน PR-B median **209.3 ms** range 125.2–244.2 ms; หลัง PR-B median **179.8 ms** range 130.9–281.8 ms ผลต่างต่อคู่เปลี่ยนเครื่องหมาย 3 ครั้งจาก 5 และ spread ต่อฝั่งใหญ่กว่าช่องว่างของ median จึงสรุปว่า **ไม่มีความแตกต่างที่วัดได้** ตามเกณฑ์ benchmark checklist ข้อ 5

ข้อจำกัดที่ต้องรายงานพร้อมตัวเลข:

- limiter คือ DB round trip และ transaction writes ไม่ใช่ CPU (12 cores, CPU ต่ำตลอดรัน); ยังไม่มี profile แยกตาม statement ในรอบนี้
- วัด sequential call กับ local DB ไม่ใช่ production load หรือ concurrent submit
- notification ถูกปิดด้วย `NODE_ENV=test` ตามสัญญาของ `src/lib/notify/index.ts` ทั้งสองฝั่ง จึงไม่ใช่ production path แบบเต็ม
- ไม่ได้จับคู่กับ measurement เดิมใน `.audit/2026-11-24-createcase-p95.md` เพราะรันคนละเวลาและคนละ load

เกณฑ์ PR-B ที่ต้องการ p95 ก่อน–หลังตอนนี้มี baseline แล้ว แต่ผลเป็น inconclusive ไม่ใช่หลักฐานว่าเร็วขึ้น
