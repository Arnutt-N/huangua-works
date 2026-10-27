# Baseline — ภาพอ้างอิงก่อนเริ่มงานแต่ละ tranche (T0)

## วิธีรัน

```bash
# 1. สตาร์ท stack + seed
docker compose up -d postgres redis up-redis
npx drizzle-kit push && npx tsx scripts/seed.ts

# 2. สตาร์ท dev server (capture script ไม่ start server เอง)
npx next dev   # http://localhost:3000

# 3. ถ่ายภาพ (commit = ชื่อโฟลเดอร์ output)
npx tsx scripts/capture-baseline.ts <commit>

# 4. เทียบก่อน/หลัง (exit 1 = ต่าง)
npx tsx scripts/diff-baseline.ts docs/baseline/<before> docs/baseline/<after>
```

## ข้อจำกัด (สำคัญ — อ่านก่อนตีความผล)

1. **หน้ายกเว้นจาก byte gate เสมอ** (มีเวลาสัมพัทธ์/สถิติเปลี่ยนตามเวลา):
   - `/` — สถิติหน้าแรก + ปีงบประมาณ
   - `/admin/reports` — `formatAge(Date.now())` (`reports/page.tsx:35-40`)
   - `/admin/cases/[id]` — `formatAge(createdAt, now)` (`cases/[id]/page.tsx:225`)
   - ไฟล์เหล่านี้ยังถูก capture (มีไฟล์ครบ = ผ่าน) แต่ไม่เทียบ byte
2. **light theme มี font-rendering noise** — anti-aliasing ต่างกันระหว่างรันแม้ content เดียวกัน (พบ ~7/18 ไฟล์ light ต่าง ขณะที่ dark นิ่ง 15/18) → gate จริงคือ **dark theme byte-compare**; light ใช้แค่ตรวจว่ามีไฟล์ครบ
3. **เทียบบน environment เดียวกันเท่านั้น** — browser/font/GPU ต่างเครื่องทำให้ PNG ต่างกัน; pin Playwright version ตาม `package.json` (`@playwright/test ^1.51.0`)
4. **ถ้ายืนยันไม่ได้ให้รายงานว่ายืนยันไม่ได้** — ไม่ใช่ fail; ระบุเหตุผลใน PR (เช่น รันคนละเครื่อง)

## caseId สำหรับ baseline

- `scripts/seed.ts` ไม่ได้สร้าง case (`grep -c "insert(cases)"` = 0) → `capture-baseline.ts` สร้างเองด้วย `createCase()` (`src/lib/cases/intake.ts:45`) แล้ว pin `caseId` ข้างล่าง
- caseId สำหรับ baseline: 01a12baa-963d-72be-b7f7-e8c7e715b3f2 (commit t0-r1)

## เกณฑ์ผ่าน T0

1. รันสคริปต์ 2 รอบติดกัน: dark theme byte-identical (ยกเว้น 3 routes ข้างบน); light มีไฟล์ครบ
2. ภาพหน้าแรกก่อนเริ่มงานทุก tranche ถูก commit ไว้
3. `diff-baseline.ts` ทำให้ gate ล้มได้จริง — ทดสอบด้วย fixture ที่ไม่ใช่ protected (ดู `docs/uxui-handoff.md` §ไฟล์ protected)
