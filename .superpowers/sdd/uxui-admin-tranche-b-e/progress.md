# SDD ledger — plan: docs/plans/uxui-admin-tranche-b-e-PRP.md

## T0 — Baseline และด่านป้องกัน

- Ruling: หน้ามีเวลาสัมพัทธ์ (`/`, `/admin/reports`, `/admin/cases/[id]` — formatAge) ยกเว้นจาก byte gate — เพราะ content เปลี่ยนตามเวลาจริง ไม่ใช่ UI regression; cost ถ้าผิด: regression บน 3 หน้านี้จับไม่ได้ ต้องตรวจด้วยตา
- Ruling: light theme ตรวจแค่มีไฟล์ครบ, gate byte-compare ใช้ dark เท่านั้น — เพราะ font-rendering noise ต่างกันระหว่างรัน (~7/18 light ต่าง, dark นิ่ง 15/18); cost ถ้าผิด: false positive ทุก tranche
- Ruling: dark `admin_reports-1440-dark.png` ต่าง 1 ไฟล์ในรอบทดสอบ (formatAge ข้ามชั่วโมงระหว่างรัน) — ยืนยันว่าต้องยกเว้น reports; ไม่งั้น gate flake
- capture 2 รอบ: t0-r1 (36 PNG), t0-r2 (36 PNG) → diff OK (exit 0)
- gate ล้มได้จริง: fixture แก้ 1 ไบต์ → `different: admin-1440-dark.png`, exit 1
