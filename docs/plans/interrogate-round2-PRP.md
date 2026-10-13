# PRP-Plan: Act On รอบสอง (G1–G4) — revised after prp-validate-plan FAIL

อ้าง PRD: `docs/plans/interrogate-round2-PRD.md` · branch: `fix/interrogate-round2`
(worktree `D:/toppublic/fix-r2-acton`)
Review รอบก่อน: NOT READY 1/10 — รุ่นนี้เติม anchors, commands, input/expected,
GOTCHA, before/after ครบตาม review (`D:/toppublic/fix-r2-acton/.agents/PRPs/plan_reviews/interrogate-round2-PRP-review.md`)

## Commands (map 1:1 กับ package.json scripts)

- `npx vitest run <file>` (script `test`)
- `npx tsc --noEmit` (script `typecheck`)
- `npx eslint <paths>` (script `lint` = `eslint .`, รอบนี้ scope เฉพาะไฟล์ที่แตะ)
- build: `npx next build` (ไม่รัน `verify-env` เต็ม — ไม่มี secret prod; tsc ผ่าน = build-safe)

## Conventions ที่ implementer ต้องใช้ (examples จริงจาก repo)

- Error mapping: `{ ok: boolean; error?: string; code?: ... }` คืนจาก service,
  route แมป code → status (mirror `src/app/api/feedback/route.ts:27-33`)
- § comment ภาษาไทยอธิบาย why (mirror `src/lib/line/rich-menu-service.ts:140-180`
  per-item try/catch)
- Test: vitest + DB จริงผ่าน `getDb()` + ล้างด้วย `DELETE ... WHERE name LIKE 'it-%'`
  ใน `beforeEach` (mirror `src/lib/line/rich-menu-alias.integration.test.ts:49-57`);
  mock LINE ด้วย `vi.mock('@/lib/line/client')`
- Audit: `logAudit({ userId, action: AUDIT_ACTIONS.*, resource, resourceId, ... })`
  (mirror `src/app/api/line/admin/rich-menus/aliases/route.ts`)

## G1 — tick รอบสอง

**ไฟล์:** `src/lib/line/rich-menu-service.ts` (`planDisplayActions` :64,
`runDisplayTick` :110), test เดิม `src/lib/line/rich-menu-schedule.test.ts`,
`src/lib/line/rich-menu-display.integration.test.ts`

- ACTION: เปลี่ยน `planDisplayActions` คืน `activate` เดิม + เพิ่ม `demote: string[]`
  (active ตัวอื่นที่แพ้ election) + `cancelDefault` คงความหมายเดิม
  (true = ต้องยกเลิก default ปัจจุบัน และไม่มี activate ใน tick นี้)
- IMPLEMENT: election ข้าม `active ∪ contenders` เลือก `displayStartAt` ล่าสุด
  (เสมอกันใช้ id มากสุด); `activate` มีเฉพาะ winner ที่ยังไม่ active;
  `runDisplayTick` อ่าน default ล้ม → ข้าม expire ทั้งหมด + `error` ออก 502;
  activate แล้ว demote ที่เหลือใน tick เดียวกัน (per-item try/catch แบบเดิม)
- MIRROR: sort + slice แบบ `contenders` เดิม (`rich-menu-service.ts:80-87`),
  try/catch รายตัวแบบ `runDisplayTick` เดิม (:140-180)
- VALIDATE: `npx vitest run src/lib/line/rich-menu-schedule.test.ts
  src/lib/line/rich-menu-display.integration.test.ts`
  + `npx tsc --noEmit` + `npx eslint src/lib/line/`
- Before/after: เดิม overlap ชนะสุ่ม + read ล้ม expire ค้างเงียบ →
  หลัง deterministic + 502 ให้เห็น
- Input/expected (unit, `now = 2026-10-13T12:00Z`):
  | input | expected |
  | active A หมดเวลา + draft B เริ่มแล้ว + default=A | activate=[B], expire=[A], cancelDefault=false |
  | read default throw | expire ไม่ขยับ, error set |
  | overlap A(11:00)+B(11:30) เปิดทั้งคู่ | activate=[B] ตัวเดียว |
- Edge: start/end เท่ากันพอดี; สอง winner เสมอ id; tick ว่างเปล่า
- GOTCHA: `setDefault` ก่อน flip DB เสมอ (LINE ลบ default ที่ชี้อยู่ไม่ได้ —
  § เดิมใน `syncRichMenu`); อย่าแตะ `cancelDefault` ความหมายเดิมนอกจากเงื่อนไข activate ว่าง

## G2 — alias race

**ไฟล์:** `src/lib/line/rich-menu-service.ts` (`createMenuAlias` :298),
`src/lib/line/client.ts` (เพิ่ม `getAliasOnLine(aliasId): Promise<{richMenuId}|null>`,
mirror `getLineRichMenu` ใน `client.ts`), test เดิม `rich-menu-alias.integration.test.ts`

- ACTION: verify `GET https://api.line.me/v2/bot/richmenu/alias/{aliasId}`
  มีจริงตอน implement (mark ไว้ — ถ้าไม่มีใช้ reconcile ผ่าน delete+create แทน)
- IMPLEMENT: catch insert — อ่านกลับก่อนลบ: เป้าตรงที่สร้างชดเชยลบได้,
  เป้าเป็นของคนอื่นปล่อยไว้ + error ให้ retry (local-first จะเจอแถว winner → 409);
  สร้างชน 4xx → อ่านกลับ เป้าตรงเขียนแถวคืน + ok
- MIRROR: local-first check แบบ `createMenuAlias` เดิม (`rich-menu-service.ts:304-312`),
  best-effort `.catch(() => {})` แบบ `deleteAliasOnLine` ใน `client.ts:206`
- VALIDATE: `npx vitest run src/lib/line/rich-menu-alias.integration.test.ts`
  + `npx tsc --noEmit`
- Before/after: N/A (internal — ไม่มี UI เปลี่ยน, พฤติกรรมนอก: retry สำเร็จแทน wedged)
- Input/expected (mock `getAliasOnLine` สองทิศ):
  | insert ชน + remote ชี้เป้าเรา | ลบชดเชย, error retry ได้ |
  | insert ชน + remote ชี้เป้าคนอื่น | ไม่ลบ, error 409 |
  | create ชน 4xx + remote ตรง | เขียนแถวคืน, ok:true |
- Edge: remote อ่านล้ม (fail-open ปล่อย orphan ไว้ + error เดิม); alias มี `/` ในชื่อ
- GOTCHA: ห้ามลบด้วยชื่อเปล่าๆ โดยไม่เช็คเจ้าของ — นั่นคือบั๊กเดิม

## G3 — menu routes

**ไฟล์:** `src/app/api/line/admin/rich-menus/[id]/route.ts` (PATCH :24, DELETE :62)

- ACTION: PATCH อ่านแถวก่อน (`select ... limit(1)`, ไม่มี → 404 ก่อน parse แพง),
  รวมคู่ stored+patch แล้ว validate (`end <= start` → 400 รวมเคสส่งข้างเดียว);
  body ว่าง `{}` → 400; audit ใส่ old→new
- IMPLEMENT: DELETE กัน `status=active`/เป็น default ปัจจุบัน (อ่านผ่าน
  `getDefaultLineRichMenu` จาก `src/lib/line/client.ts`) → 409;
  ลบ remote best-effort ก่อนลบแถว; try/catch แมป FK (`23503`) → 409 ที่เหลือ 500 JSON
  (PRD G3 อนุมัติ ordering นี้แล้ว — ปิดประเด็น B4)
- MIRROR: `parseBody` + `requireStaffApi(ADMIN_ROLES)` + `logAudit` แบบ route ข้างกัน
  (`aliases/route.ts`); `isUniqueViolation` → `pgCode` ใน `src/lib/db/errors.ts:2`
  สำหรับเช็ค code
- VALIDATE: `npx vitest run "src/app/api/line/admin/rich-menus/[id]/route.test.ts"`
  + `npx tsc --noEmit`
- Before/after: เดิม PATCH ข้างเดียวกลับหัวได้ 200 + DELETE ลบ default สดได้ →
  หลัง 400/409 ตามเคส
- Input/expected:
  | PATCH {end} ข้างเดียวกลับหัวกับของเก่า | 400 |
  | PATCH {} | 400 |
  | DELETE เมนู active/default | 409 |
  | DELETE ติด alias กลางทาง (mock) | 409 ไม่ใช่ 500 |
- Edge: start=end พอดี (400); ลบเมนูไม่มีตัวตน (404 เดิมคงอยู่)
- GOTCHA: `datetime-local` ส่ง local offset — เทียบด้วย `getTime()` ไม่ใช่ string
  (string ต่าง offset เรียงผิด)

## G4 — tier key (UI 1 จุด)

**ไฟล์:** `src/app/admin/users/users-client.tsx:255`
(`<TierMatrixCard tierMatrix={tierMatrix} />`)

- ACTION: `<TierMatrixCard key={JSON.stringify(tierMatrix)} tierMatrix={tierMatrix} />`
- IMPLEMENT: บรรทัดเดียว — remount เมื่อข้อมูลใหม่มา (ตรง comment ที่สัญญาไว้)
- MIRROR: `key=` ใน list rows ไฟล์เดียวกัน (pattern มีอยู่แล้ว)
- VALIDATE: `npx tsc --noEmit` + `npx eslint src/app/admin/users/users-client.tsx`
  (repo ไม่มี test component — บันทึกเป็นข้อจำกัด ไม่ใช่ช่องโหว่ gate)
- Before/after: เดิม save สองครั้งทับกันเงียบ → หลังฟอร์มรีเซ็ตตามข้อมูลใหม่เสมอ
- Input/expected: N/A (internal remount — verify ด้วย tsc/eslint)
- Edge: `tierMatrix` เปลี่ยน reference ทุก render (parent สร้าง object ใหม่) →
  remount ถี่ได้ ยอมรับได้เพราะหน้านี้ไม่มี render ถี่ (server component ส่ง prop ครั้งเดียว)
- GOTCHA: อย่าใช้ `useEffect` sync แทน (สองกลไกซ้อนกัน) — key อย่างเดียวพอ

## Review gate (รอบ revise)

- [x] Anchors: ทุกฟังก์ชัน/ไฟล์อ้างมีจริง (verify ด้วย grep ใน worktree ข้างบน)
- [x] Commands: ระบุ runnable ครบ + map package.json scripts + build
- [x] Input/expected ทุก tranche + edge checklist
- [x] B4 ปิด: PRD G3 เพิ่ม ordering remote-delete (ดู PRD ประกอบ)
- [x] G2 text สะอาด ไม่มี token เพี้ยน; cancelDefault fate ระบุใน G1
