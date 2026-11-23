# นิยามสถิติเรื่องร้องเรียน

เอกสารนี้กำหนดความหมายของตัวเลขบน dashboard และ cron สถิติ ใช้แหล่งหลักคือ Excel `secrets/docs/Dashboard เรื่องร้องเรียนร้องทุกข์ สาธารณูปโภค กองช่าง ประจำเดือน ปี 2569.xlsx` และ state machine ใน `src/lib/cases/state-machine.ts`

## แหล่งข้อมูล

Excel ใช้สูตร `COUNTA(DATA!B4:B1047)` นับเลขเรื่องทุกแถวเป็นยอดทั้งหมด และใช้ `COUNTIF(DATA!J4:J1047, status)` นับตามคอลัมน์สถานะ สัดส่วนแต่ละสถานะหารด้วยยอดทั้งหมด

ระบบเก็บสถานะใน `cases.status` และกำหนด transition ใน `src/lib/cases/state-machine.ts` สถานะปลายทางคือ `closed` และ `rejected`

## นิยาม

| ค่า | นิยาม | แหล่ง |
|---|---|---|
| ยอดเรื่องทั้งหมด | จำนวนแถวใน `cases` ทุกสถานะ | `COUNTA` ใน Excel |
| ยอดตามสถานะ | จำนวนแถวที่ `cases.status` ตรงกับสถานะนั้น | `COUNTIF` คอลัมน์ J ใน Excel |
| กำลังดำเนินการ | ผลรวมตาม `OPEN_STATUSES` ได้แก่ `pending`, `received`, `reviewing`, `awaiting_budget`, `assigned`, `in_progress` | state machine |
| ปิดสำเร็จ | จำนวนแถวที่ `cases.status = 'closed'` | `COUNTIF` ใน Excel |
| ไม่ดำเนินการ | จำนวนแถวที่ `cases.status = 'rejected'` | `COUNTIF` ใน Excel |
| อัตราปิด | `count(closed) / count(cases)` คูณ 100 ปัดเป็นจำนวนเต็ม | `I8/A8` ใน Excel |
| เฉลี่ยวันปิด | ค่าเฉลี่ยของ `closedAt - createdAt` จากแถวที่ `closedAt` ไม่เป็น null เท่านั้น | สูตรเดิมใน cron |

## การใช้งานในโค้ด

`deriveStatusStats()` ใน `src/lib/cases/stats.ts` เป็นตัวคำนวณเดียวสำหรับ cron และ dashboard ใช้ชื่อ field `totalReceived` เพื่อความเข้ากันได้กับ snapshot เดิม แต่ค่านี้หมายถึงยอดเรื่องทั้งหมดตาม Excel ไม่ใช่ `count(status = 'received')`

`src/app/api/cron/stats-refresh/route.ts` เขียนค่าลง `case_stats_daily` ตามนิยามนี้ `src/app/admin/page.tsx` ใช้ค่าจาก snapshot และใช้ `deriveStatusStats()` เป็น fallback เมื่อยังไม่มี snapshot
