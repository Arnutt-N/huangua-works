# PRP-Plan: แก้ผล interrogate (F1–F6)

อ้าง PRD: `docs/plans/interrogate-fix-PRD.md` · branch: `fix/interrogate-act-on`
(worktree `D:/toppublic/fix-interrogate` — ห้ามทำในต้นไม้กลางที่โดนย้าย branch)

## ลำดับ tranche (F1 → F6, เส้นเดียว แยก commit)

### F1 — tick ordering + preconditions (`src/lib/line/rich-menu-service.ts`)

- `planDisplayActions`: เพิ่ม `requireStart` (activate ต้องมี start ผ่านแล้ว),
  overlap เลือก `displayStartAt` ล่าสุดตัวเดียว (`activateWinner` + ที่เหลือคง draft)
- `runDisplayTick`: ลำดับใหม่ — cancel เฉพาะเมื่อ `activate` ว่าง; commit DB ทีละเมนู
  พร้อม try/catch รายตัว เก็บ counts จริง (ไม่ zero เหมารวม)
- test: `rich-menu-schedule.test.ts` (+tick รวม, end-only, overlap),
  `rich-menu-display.integration.test.ts` (+tick รวม cancel ไม่ถูกเรียก)
- เสี่ยง: เปลี่ยนพฤติกรรม overlap เดิม (สุ่ม → deterministic) — ตั้งใจตาม PRD

### F2 — feedback errors (`src/lib/cases/feedback.ts`, `src/app/api/feedback/route.ts`)

- `submitFeedback`: `normalizeTrackingCode` ก่อน (`src/lib/case-tracking.ts:41` มีแล้ว);
  catch เช็ค `isUniqueViolation` (`src/lib/db/errors.ts:2` มีแล้ว) ค่อย 409
- route: ใช้ `formatReset` กับ 429 (ปิดจ็อบ #110 ตกหล่น)
- test: ขยาย `route.integration.test.ts` (code ตัวเล็กมีช่องว่าง → 201;
  mock insert throw → 500; 429 มีคำว่านาที)
- เสี่ยง: ต่ำ (pure + service เดิม)

### F3 — tier stale rows (`src/lib/auth/tiers.ts` + migration)

- `pickTierRoles`/`loadTierMap`: union superadmin ตอนอ่าน (ยกเว้น tier superadmin เอง);
  กรองด้วย `ALL_ROLES` ในที่เดียว (รวมกับงาน F5)
- migration backfill: `UPDATE tier_roles SET roles = ARRAY(SELECT DISTINCT unnest(roles || '{superadmin}'))`
  (idempotent รันซ้ำได้)
- test: seed แถวเก่า `['head']` → `getTierRoles('admin')` มี superadmin
- เสี่ยง: migration บนตารางที่ prod อาจยังว่าง — idempotent จึงปลอดภัย

### F4 — alias lifecycle (`rich-menu-service.ts`, `client.ts`, routes)

- `createMenuAlias`: เช็ค local ซ้ำก่อนยิง LINE (409 สะอาด); insert ล้ม →
  `deleteAliasOnLine` ชดเชย (best-effort) แล้วค่อย error
- `client.ts`: `encodeURIComponent(aliasId)` ใน PUT/DELETE
- routes: `isValidAliasId` ที่ PUT/DELETE (400); แยก 404 (alias/menu ไม่มีตัวตน)
  กับ 422 (เป้าไม่ sync); `repoint` อัป `updatedAt`; DB write ทุกตัวใน try/catch
- `deleteMenuAlias`: เช็คแถว local ก่อน (ไม่มี → 404 ไม่ audit)
- test: ขยาย `rich-menu-alias.integration.test.ts` (ซ้ำ→409 แล้ว retry ได้;
  ชื่อผิด→400; ลบของไม่มี→404; repoint อัป timestamp)
- เสี่ยง: ปานกลาง (หลายไฟล์) — test คลุมก่อน refactor เสมอ

### F5 — tier hardening (`tiers.ts`, `require-staff.ts`, `actions/tiers.ts`, UI)

- dispatch: `TIER_BY_REF` → key ด้วย `[...allowedRoles].sort().join(',')`
- `updateTierRoles`: validate 3 tier ก่อน แล้วค่อยเขียน; audit ค่า `forced`
  (คืนจาก `setTierRoles`)
- `resolveAllowedRoles` catch: `console.warn` (ไม่มี PII)
- `EDITABLE` + `TIER_ROLE_OPTIONS` derive จาก `ALL_ROLES` (เว้น citizen)
- กัน self-lockout: actor ไม่ใช่ superadmin แต่ตัดตัวเองออกadmin → ปฏิเสธ
- UI: superadmin checked+disabled + ป้ายบังคับ; แก้ copy ว่าง; checkbox controlled
  หรือ `key` รีเซ็ต (เลือกตอน implement — เล็กสุดที่หายค้าง)
- cache: export invalidate (หรือ wrapper) เรียกใน `setTierRoles` ก่อน bump;
  test อ่าน `getTierRoles` หลังเขียนต้องได้ค่าใหม่ (ลบ workaround อ่าน DB ตรง)
- test: value-key dispatch, validate-first (matrix ไม่ขยับเมื่อล้ม),
  self-lockout, invalidate (TDD red ก่อนทุกตัว)
- เสี่ยง: สูงสุดในชุด (auth ทุก request) — รันชุด auth + admin เต็มก่อน commit

### F6 — schedule แก้ไขได้ + เก็บตก (`rich-menus/[id]`, track-form, format-reset, rating)

- `PATCH /api/line/admin/rich-menus/[id]` (schedule nullable + validate เดิม) +
  `DELETE` (ติด alias → 409); UI ปุ่มแก้/ล้าง/ลบในแถวเมนู
- `FeedbackCard`: `key={trackingCode}` + ส่ง code ที่ trim แล้ว
- `format-reset.ts`: clamp (`Math.max(0, Math.floor)`) + test 0/ลบ
- migration: `CHECK (rating BETWEEN 1 AND 5)` + CSAT reader ขั้นต่ำ
  (avg/count ต่อหมวด — วางใน reports ที่มีอยู่)
- cron test เคส 502
- test: ทุกตัวบน (TDD), รัน whitelist รอบข้าง (admin/reports, track)
- เสี่ยง: ต่ำ-ปานกลาง (กระจายหลายไฟล์เล็ก)

## Review gate (ตรวจแล้วรอบเขียนแผน)

- [x] PRD ครบ ปัญหา/ขอบเขต/เกณฑ์/ข้อจำกัด — oracle กับ rejected บันทึกเหตุผลที่คงเดิมไว้แล้ว
- [x] PRP file-level: helper มีจริง (`case-tracking.ts:41`, `db/errors.ts:2`);
  path เป้าหมายมีจริงทุกไฟล์ (verify ด้วย grep ใน worktree)
- [x] ลำดับ F1→F6 ไม่มีวงจร (F5 แตะ tiers.ts ที่ F3 แตะ — F3 มาก่อนเสมอ)
- [x] สมมติฐาน: ไม่แตะ #110 (แก้ไฟล์เราเอง); migration ผ่าน generate + ตรวจ snapshot;
  DB local มีตารางครบแล้ว (F3 backfill รันซ้ำได้)
