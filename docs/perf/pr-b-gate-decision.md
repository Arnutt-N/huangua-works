# เกณฑ์ตัดสิน perf gate ของ PR-B

เขียนก่อนรัน 26 พฤศจิกายน 2569

คำกล่าวที่ต้องการทดสอบ: "PR-B เปลี่ยน p95 ของ `createCase()` บน Postgres จริง"

วิธี: สลับฝั่ง baseline `deef129` กับ current `65c42d8` อย่างละ 5 รอบ รอบละ 20 call แบบ concurrent 4 workers ตัด notification ด้วย `NODE_ENV=test` ตรวจทุก call ว่ามีแถวจริง นับ error และลบ fixture หลังรอบ

 noise floor = ช่วงของ p95 จาก 5 รอบในฝั่งใดฝั่งหนึ่ง เมื่อช่วงดังกล่าวกว้างกว่าผลต่างของ median ให้ถือว่ายังตัดสินไม่ได้จาก sequential run

ก่อนตัดสินต้องหาตัวจำกัดด้วย Postgres statement log ในรอบ profile ที่ไม่นับผล ถ้าตัวจำกัดคือ client-side overhead ให้เปลี่ยนไปใช้ concurrent load ก่อน แล้วจึงตัดสิน

กฎตัดสิน:
- เร็วขึ้น: p95 ของ current ต่ำกว่า baseline ในอย่างน้อย 4 จาก 5 คู่ และผลต่างเกิน spread ของ baseline
- ช้าลง: ตรงข้าม
- ไม่มีความแตกต่างที่วัดได้: เงื่อนไขข้างต้นไม่เป็นไปตามใดเลย ให้ปิด gate ด้วยข้อสรุปนี้ พร้อมระบุตัวจำกัดและ spread

ห้ามเปลี่ยนเกณฑ์หลังเห็นตัวเลข

## ผลที่วัดได้

วัดวันที่ 26 พฤศจิกายน 2569 บน local Postgres `127.0.0.1:5433` คู่ละ 20 call concurrency 4 รวม 100 call ต่อฝั่ง errors = 0 ทุกคู่

| คู่ | p95 ก่อน PR-B | p95 หลัง PR-B | ผลต่าง (ก่อน − หลัง) |
|---:|---:|---:|---:|
| 1 | 198.3 ms | 167.2 ms | +31.1 ms |
| 2 | 202.7 ms | 295.7 ms | −93.0 ms |
| 3 | 126.5 ms | 216.5 ms | −90.0 ms |
| 4 | 229.1 ms | 305.8 ms | −76.7 ms |
| 5 | 338.8 ms | 427.2 ms | −88.4 ms |

ก่อน PR-B median p95 = **202.7 ms** ช่วง 126.5–338.8 (spread 212.3 ms); หลัง PR-B median p95 = **295.7 ms** ช่วง 167.2–427.2 (spread 260.0 ms)

ผลต่างต่อคู่: หลัง PR-B ช้ากว่า 4 จาก 5 คู่ ตามเกณฑ์ทิศทาง แต่ median delta 93.0 ms ต่ำกว่า noise floor ที่เป็น spread ของ baseline 212.3 ms มาก เกณฑ์ตัดสินจึงลงที่ **ไม่มีความแตกต่างที่วัดได้** ไม่ใช่ inconclusive แบบไม่มีข้อมูล แต่เป็นข้อสรุปจากกฎที่เขียนไว้ล่วงหน้า

### ตัวจำกัดจากรอบ profile ที่ไม่นำตัวเลขไปตัดสิน

เปิด `log_min_duration_statement = 0` ชั่วคราวแล้ว reset กลับ `-1` ทุกครั้ง เก็บ 20 call ต่อฝั่ง

| รายการ | ก่อน PR-B | หลัง PR-B |
|---|---:|---:|
| execute statements | 293 | 317 |
| parse total | 95.0 ms | 99.4 ms |
| bind total | 179.9 ms | 158.4 ms |
| execute total | 366.8 ms | 289.0 ms |
| commit | 24 ครั้ง, 198.8 ms, max 19.3 ms | 24 ครั้ง, 156.0 ms, max 18.2 ms |

PR-B ตัด SELECT ตรวจ tracking code 24 ครั้งออก แต่เพิ่ม SAVEPOINT และ nested commit ต่อ call ค่า execute ต่อฝั่งจึงเปลี่ยนรูปไม่ใช่ลดลงชัดเจน ตัวจำกัดคือ commit และ client-side parse/bind หลายรอบต่อคำขอ ไม่ใช่ statement เดียวที่ช้า

### ข้อจำกัด

- local DB และ `NODE_ENV=test` ปิด notification ทั้งสองฝั่ง ไม่ใช่ production path เต็ม
- spread สูงมากเมื่อเทียบกับ delta แสดงว่ามี load drift จากเครื่องที่ใช้ร่วมกับงานอื่น ตัวเลขนี้ใช้ตัดสินทิศทางไม่ได้แต่ใช้ปิด gate ตามเกณฑ์ที่เขียนล่วงหน้าได้
- profile วัดแค่ statement duration ไม่ได้จับ lock wait หรือ WAL flush แยก
