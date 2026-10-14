# PRP-Plan: Act On รอบสอง (G1–G4) — revised r3 (หลัง review NOT READY 1/10)

อ้าง PRD: `docs/plans/interrogate-round2-PRD.md` · branch: `fix/interrogate-round2`
(worktree `D:/toppublic/fix-r2-acton`)
แก้ตาม `D:/toppublic/fix-r2-acton/.agents/PRPs/plan_reviews/interrogate-round2-PRP-review-r2.md`:
refs ถูกต้อง, fallback ถูกตัด, test ผูกไฟล์, มี NOT Building ในแผนเอง

## Commands (map package.json: test=vitest run, typecheck=tsc --noEmit, lint=eslint ., build=next build)

- `npx vitest run <file>` ต่อ tranche
- `npx tsc --noEmit`
- `npx eslint <paths>` (scope ไฟล์ที่แตะ; `eslint .` ทั้ง repo ช้า)
- build: ไม่รัน `next build` เต็ม (ต้องมี secret prod) — `tsc` ผ่าน = build-safe
  (บันทึกเป็นข้อจำกัดชัด ไม่ใช่ช่องโหว่ gate)

## Conventions (examples จริง)

- Error mapping: `{ ok: boolean; error?: string; code?: string }` จาก service,
  route แมป code → status
  (mirror `src/app/api/feedback/route.ts:24-30` STATUS_BY_CODE + `:45-47` จุด map)
- § comment ไทยอธิบาย why (mirror `src/lib/line/rich-menu-service.ts:140-180`)
- Test: vitest + DB จริงผ่าน `getDb()` + ล้าง `DELETE ... WHERE name LIKE 'it-%'`
  ใน `beforeEach` (mirror `src/lib/line/rich-menu-alias.integration.test.ts:49-57`);
  LINE mock ด้วย `vi.mock('@/lib/line/client')`
- Audit: `logAudit({ userId, action: AUDIT_ACTIONS.*, resource, resourceId, metadata })`
  (mirror `src/app/api/line/admin/rich-menus/aliases/route.ts`)
- Dependencies: `drizzle-orm`, `zod`, `vitest`, `postgres-js`
  (versions ตาม `package.json` — ไม่ pin ในแผน ให้ lockfile เป็น truth)

## NOT Building (ขอบเขตในแผนเอง)

- ไม่แตะ PR #110 (ของ session อื่น)
- ไม่สร้างระบบ reconcile กลาง/คิวงาน — compensate แบบ best-effort ต่อ call พอ
- ไม่เปลี่ยนความหมาย `cancelDefault` เดิม (true = ต้องยกเลิก + ไม่มี activate)
- ไม่เพิ่มตาราง/คอลัมน์ใหม่ (ใช้ของเดิมทั้งหมด)

## G1 — tick รอบสอง

**ไฟล์:** `src/lib/line/rich-menu-service.ts` (`planDisplayActions` :64,
`runDisplayTick` :110, `DisplayTickResult` type เดิม `{activated, expired, failed, error?}`)

- ACTION: ขยาย `DisplayTickResult` เพิ่ม `demoted: number`
  (`src/lib/line/rich-menu-service.ts:110-116`)
- IMPLEMENT:
  1. `planDisplayActions` คืน `activate` (winner เดียว), `demote: string[]`
     (active ตัวอื่นที่ window หมดหรือแพ้ election), `expire`, `cancelDefault` (คงเดิม)
  2. `runDisplayTick`: read default ล้ม → ข้าม expire ทั้งหมด + `error` ออก 502;
     activate แล้ว demote ที่เหลือใน tick เดียวกัน (per-item try/catch แบบเดิม :140-180)
- MIRROR: sort + slice แบบ contenders เดิม (:80-87); try/catch รายตัวแบบเดิม
- VALIDATE: `npx vitest run src/lib/line/rich-menu-schedule.test.ts
  src/lib/line/rich-menu-display.integration.test.ts` + `npx tsc --noEmit` +
  `npx eslint src/lib/line/`
- Before/after: เดิม winner ชนะ tick เดียวแล้วถอย + read ล้ม expire ค้างเงียบ →
  หลัง sticky-winner + 502 ให้เห็น
- Input/expected → ไฟล์ test (สร้างใหม่ในไฟล์เดิม):
  | `schedule.test.ts` › election ข้าม incumbent (A active ใหม่กว่า + B draft เก่ากว่า) | activate=[] (A อยู่แล้ว), demote=[] |
  | `schedule.test.ts` › demote ตัวแพ้ (A+B เปิดพร้อมกัน) | activate=[B], demote=[A] |
  | `display.integration.test.ts` › หลาย tick (apply→replan) | default อยู่ตัวล่าสุดตัวเดียว |
  | `display.integration.test.ts` › read ล้ม (mock getDefault throw) | expire ไม่ขยับ, error set |
- Edge: start/end เท่ากันพอดี; เสมอ id; tick ว่างเปล่า
- GOTCHA: `setDefault` ก่อน flip DB เสมอ (LINE ลบ default ที่ชี้อยู่ไม่ได้ —
  § เดิมใน `syncRichMenu`); demote ใช้ status flip อย่างเดียว ไม่แตะ LINE default
  (default อยู่ที่ winner อยู่แล้ว)

## G2 — alias race

**ไฟล์:** `src/lib/line/rich-menu-service.ts` (`createMenuAlias` :298),
`src/lib/line/client.ts` (เพิ่ม `getAliasOnLine` ข้าง `getLineRichMenu` :123)

- ACTION: `GET https://api.line.me/v2/bot/richmenu/alias/{aliasId}`
  (LINE API มาตรฐาน คู่กับ PUT/DELETE ที่มีอยู่แล้วใน `client.ts` —
  ไม่ต้อง verify เพิ่ม; ไม่มี fallback branch)
- IMPLEMENT (`client.ts`):
  `export async function getAliasOnLine(aliasId: string): Promise<{ richMenuId: string } | null>`
  (404 → null; pattern เดียวกับ `getLineRichMenu` :123-136 รวม headers/timeout/LineApiError)
- IMPLEMENT (`rich-menu-service.ts` `createMenuAlias` catch):
  อ่านกลับ `getAliasOnLine(aliasId)` — เป้าตรงที่สร้างชดเชยลบได้,
  เป้าเป็นของคนอื่นปล่อยไว้ + error ให้ retry (local-first จะเจอแถว winner → 409);
  สร้างชน 4xx → อ่านกลับ เป้าตรงเขียนแถวคืน + ok
  (import: `getAliasOnLine` จาก `'@/lib/line/client'`)
- MIRROR: local-first check แบบเดิม (`rich-menu-service.ts:304-312`),
  best-effort `.catch(() => {})` แบบ `deleteAliasOnLine` (`client.ts:206`)
- VALIDATE: `npx vitest run src/lib/line/rich-menu-alias.integration.test.ts`
  + `npx tsc --noEmit`
- Before/after: N/A ภายใน (พฤติกรรมนอก: retry สำเร็จแทน wedged)
- Input/expected → `rich-menu-alias.integration.test.ts` (เคสใหม่):
  | insert ชน + remote ชี้เป้าเรา (mock) | ลบชดเชย, error retry ได้ |
  | insert ชน + remote ชี้เป้าคนอื่น | ไม่ลบ, error 409 |
  | create ชน 4xx + remote ตรง | เขียนแถวคืน, ok:true |
- Edge: remote อ่านล้ม (fail-open ปล่อย orphan + error เดิม); alias มี `/` (โดน
  `isValidAliasId` ดักตั้งแต่ create — ไม่ใช่เคสนี้)
- GOTCHA: ห้ามลบด้วยชื่อเปล่าๆ โดยไม่เช็คเจ้าของ — นั่นคือบั๊กเดิม

## G3 — menu routes

**ไฟล์:** `src/app/api/line/admin/rich-menus/[id]/route.ts` (PATCH :24, DELETE :62)

- ACTION PATCH: อ่านแถวก่อน (`select ... limit(1)`; ไม่มี → 404 ก่อน parse):
  รวมคู่ `effective = { start: body.start ?? row.start, end: body.end ?? row.end }`,
  validate คู่รวม (`end <= start` → 400); body ว่าง `{}` (สอง field undefined)
  → 400; audit `metadata: { before: {start, end}, after: {start, end} }`
- ACTION DELETE: กัน `status=active`/เป็น default ปัจจุบัน
  (อ่านผ่าน `getDefaultLineRichMenu` จาก `@/lib/line/client`) → 409;
  ลบ remote (`deleteLineRichMenu`, best-effort) ก่อนลบแถว;
  try/catch แมป FK ด้วย `pgCode(err) === '23503'` → 409 ที่เหลือ 500 JSON
  (import `pgCode` จาก `@/lib/db/errors` — ไม่ใช่ `isUniqueViolation` ที่เช็ค 23505 เท่านั้น)
- MIRROR: `parseBody` + `requireStaffApi(ADMIN_ROLES)` + `logAudit` แบบ
  `aliases/route.ts`; `AUDIT_ACTIONS.RICH_MENU_UPDATE/RICH_MENU_DELETE` (มีใน enum แล้ว)
- VALIDATE: `npx vitest run "src/app/api/line/admin/rich-menus/[id]/route.test.ts"`
  (สร้างเคสใหม่ในไฟล์นี้) + `npx tsc --noEmit`
- Before/after: เดิม PATCH ข้างเดียวกลับหัวได้ 200 + DELETE ลบ default สดได้ →
  หลัง 400/409 ตามเคส
- Input/expected → `[id]/route.test.ts` (เคสใหม่):
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
- Edge: `tierMatrix` เปลี่ยน reference ทุก render → remount ถี่ได้ ยอมรับได้เพราะ
  parent เป็น server component ส่ง prop ครั้งเดียว (verify: `page.tsx:47,65`)
- GOTCHA: อย่าใช้ `useEffect` sync แทน (สองกลไกซ้อนกัน) — key อย่างเดียวพอ

## Review gate (รอบ revise)

- [x] Anchors: ทุกฟังก์ชัน/ไฟล์อ้างมีจริง (verify ด้วย grep ใน worktree — ดู_RESPONSE ข้างบน)
- [x] Commands: ระบุ runnable ครบ + map package.json scripts + build scope
- [x] Input/expected ผูกไฟล์ test ทุก tranche + edge checklist
- [x] B4 ปิด: NOT Building ในแผนเอง; G2 ไม่มี fallback branch แล้ว
- [x] G2 text สะอาด; cancelDefault/demote fate ระบุใน G1
