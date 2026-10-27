# Plan Review: uxui-admin-tranche-b-e-PRP

**Skill**: `prp-validate-plan` v2.0.0 (2026-10-25)
**Plan**: `docs/plans/uxui-admin-tranche-b-e-PRP.md`
**Reviewed**: 2026-10-25
**Source PRD**: `docs/plans/uxui-admin-tranche-b-e-PRD.md`
**Findings Input**: none (B7 SKIPPED)
**Review Mode**: dual (context isolation only — model-override attempt 429 `FreeUsageLimitError` → retry without override)
**Verdict**: NOT READY
**Confidence Score**: 1/10 — single-pass implementation

## Reviewer Verdicts

| Reviewer | Diversity | Verdict | Critical issues | Important issues |
|---|---|---|---|---|
| A | context isolation only (parent model) | FAIL | 0 | 4 |
| B | context isolation only (retry; first attempt with model override failed 429) | FAIL | 2 | 6 |

## Rubric Results

| # | Criterion | A | B | Aggregate | Evidence |
|---|---|---|---|---|---|
| A1 | Context Completeness | PASS | FAIL | FAIL | B: "17 callers ตามรายการใน PRD" — PRP:155 อ้าง PRD แต่ PRD ไม่มีรายการ; `users-client.test.tsx (ถ้ามี)` (PRP:77) ไม่มีจริง; `ApiFail` type (admin-api.ts:13) ไม่ถูกกล่าวถึงทั้งที่ NET-02 ต้องแก้ |
| A2 | Implementation Readiness | FAIL | FAIL | FAIL | A: helper module ไม่ตัดสิน, contract test ไม่ระบุไฟล์/harness, `useMediaQuery` ไม่มี path; B: ConfirmDialog `onConfirm: () => void` ต่อกับ server action อย่างไรไม่ระบุ, `resolveAllowedRoles` ไม่ได้ export |
| A3 | Pattern Faithfulness | PASS | FAIL | FAIL | B: ~15 refs ถูกหมด ยกเว้น `tiers.ts:112-114` (คือ `getTierRoles`; fail-closed จริงที่ `require-staff.ts:28-32`) = dead file:line → instant FAIL ตาม rubric |
| A4 | Validation Coverage | PASS | FAIL | FAIL | B: ไม่มี build command ทั้งที่ `package.json:14` มี `build: next build && tsx scripts/verify-env.ts` (env gate เดียวของรีโป) |
| A5 | UX Clarity | PASS | PASS | PASS | before/after ทุก task ใน PRD §2/§4 + PRP เกณฑ์ผ่านต่อรหัส |
| A6 | No Prior Knowledge Test | FAIL | FAIL | FAIL | ทั้งคู่: จุดที่ต้องเดา/ค้น = helper signature/export, hook path, Zod refine location, contract test, 17 callers, ApiFail type |
| B1 | Spec Coverage | PASS | PASS | PASS | 13 รหัส + T0 map ครบ T0–T4 |
| B2 | Internal Consistency | PASS | FAIL | FAIL | FLOW-03 (PRP:115 เติม `&return=` ใน 8 redirect) ขัด FLOW-04 (PRP:123 ลบ redirect เดียวกันทั้ง 8); `handleCreate(mode)` ไม่รองรับ sendNow; FLOW-04 ไม่รวม `cases/[id]/page.tsx` |
| B3 | Technical Soundness | PASS | PASS | PASS | AbortSignal.any/timeout, React 19 inert, Tailwind v4 pointer-coarse, zod, Radix — API จริงทั้งหมด |
| B4 | Scope Discipline | PASS | PASS | PASS | out-of-scope ชัด; ไม่มี task แตะไฟล์ protected |
| B5 | Risk Coverage | PASS | PASS | PASS | ตาราง 7 ความเสี่ยง + mitigation ครบ |
| B6 | Testability | FAIL | PASS | FAIL | A: input/expected pairs ครบเฉพาะ `safeInternalPath` + FORM-01; FORM-02/03, A11Y, NET ระบุแค่ชื่อกรณี; B ถือว่าผ่าน — split ที่ aggregate fail |
| B7 | Finding Coverage | SKIPPED | SKIPPED | SKIPPED | ไม่มี findings input |

## 🔴 Critical (must fix before implementing)

1. **FLOW-03 ขัด FLOW-04 ในไฟล์เดียวกัน** — PRP §5 FLOW-03 สั่งเติม `&return=` ให้ 8 redirect ใน `src/app/admin/actions/cases.ts:60,81,101,122,147,177,201,233` แต่ §5 FLOW-04 สั่ง **ลบ** redirect ทั้ง 8 บรรทัดนั้น ไม่มีลำดับหรือ supersede — implementer จะเดา ต้องตัดสิน: คง redirect+return หรือลบ redirect แล้วพึ่ง `?return` ใน searchParams
2. **file:line fail-closed ผิด + semantics เสี่ยง fail-open** — PRP:102 อ้าง `tiers.ts:112-114` เป็น fail-closed แต่บรรทัดนั้นคือ `getTierRoles` (`src/lib/auth/tiers.ts:112-114`); fail-closed จริงอยู่ใน catch ของ `resolveAllowedRoles` ที่ `src/lib/auth/require-staff.ts:28-32` — ทำตามแผนตรง ๆ ได้ helper ที่ sync/คัดลอก list ตายตัว แทน async + DB tier matrix = ขยายสิทธิ์ได้

## 🟡 Important (should fix)

- `resolveAllowedRoles` เป็น private (`require-staff.ts:19`) และ async — แผนให้ `canUseSupervisorActions(role)` แบบ sync พร้อม 2 ทางเลือกโมดูล (`require-staff.ts` หรือ `permissions.ts` ใหม่) ไม่ตัดสิน → ต้องเลือกโมดูล, export, signature async ให้จบ
- `ApiFail = { ok:false; error:string; status:number }` (`src/app/admin/_lib/admin-api.ts:13`) ไม่มี field `code` — NET-02 ให้เพิ่ม `code` แต่ไม่มี task แก้ type → tsc ฟ้องตอนลงมือ
- PRP:155 "ตรวจ caller 17 ตัว ตามรายการใน PRD" — PRD ไม่มีรายการ → ต้องย้ายรายชื่อ 17 caller เข้า PRP
- PRP:77 `users-client.test.tsx (ถ้ามี)` — ไม่มีจริง (`src/app/admin/users/` มีแค่ `page.tsx`, `users-client.tsx`) → ระบุ "สร้างใหม่"
- FLOW-04 "ไฟล์ที่แก้" ไม่รวม `src/app/admin/cases/[id]/page.tsx` ทั้งที่ `SuccessToast` (`:189`) และ `searchParams.ok` (`:34-37`) จะกลายเป็น dead path หลังลบ redirect
- `handleCreate(mode: 'draft' | 'schedule')` (PRP:66) ไม่มีที่ให้ sendNow ทั้งที่บอก "คงเดิม" → `mode: 'draft'|'schedule'|'send-now'`
- ConfirmDialog `onConfirm: () => void` (`confirm-dialog.tsx:14-25`) ไม่สามารถเรียก `toggleUserActive(prevState, formData)` ตรง ๆ → ระบุวิธีต่อ (FormData/hidden input/useActionState)
- `useMediaQuery` ไม่มี path + SSR fallback (hydration mismatch) และ Zod refine ต้องลง `createSchema` ใน `src/app/api/line/admin/broadcasts/route.ts:17` (ไม่ใช่ `src/lib/validation.ts`)
- Contract test POST broadcasts: ไม่ระบุไฟล์/วิธี invoke route handler
- B6: input/expected pairs + edge-case checklist ยังขาดสำหรับ FORM-02/03, A11Y-01..04, NET-02/04

## 🟢 Minor / Suggestions

- เพิ่ม `npx next build` หรือ `npx tsx scripts/verify-env.ts` ใน §10 checklist (`package.json:14,24`) — env gate เดียวของรีโป
- ระบุ path เต็มใน PRP §7: `settings-client.tsx`, `auto-replies/[id]/intent-detail-client.tsx`, `rich-menus/[id]/edit/edit-client.tsx`
- ระบุว่า `toggleUserActive` ยัง `redirect('/admin/users?ok=toggled')` ตอนสำเร็จ (นอกขอบเขต FLOW-04 ที่ลบเฉพาะ `actions/cases.ts`)
- ระบุ hidden input field name ของ `return` ให้ตรงกัน form ↔ action
- แยก `TIMEOUT` ออกจาก `NETWORK` ใน `code` (`AbortSignal.timeout` reject ด้วย `TimeoutError`)
- T0: ลิสต์ route admin ที่ต้อง screenshot ทั้งหมด + ตรึง seed ให้ชัด + ใครตรวจ "ภาพนิ่ง 2 รอบ"

## Reviewer Disagreements

- **A1, A3, A4**: A ให้ PASS ทั้งสาม, B ให้ FAIL — A ยืนยัน refs 6 จุด, B ไล่ ~15 จุดและเจอ dead ref (`tiers.ts:112-114`) + ขาด build command → aggregate FAIL (B ค้นลึกกว่า)
- **B2**: A PASS / B FAIL — B จับ contradiction FLOW-03 vs FLOW-04 ที่ A มองข้าม
- **B6**: A FAIL / B PASS — ต่างมาตรฐาน "input/expected ต่อหน่วย"; aggregate FAIL

## Confidence

```
raw_score = 10 − 2×5 (A1,A2,A3,A4,A6) − 1×2 (B2,B6) − 1×1 (ApiFail type gap)
          = −3 → clamped 1
consensus FAIL → min(…, 7) = 1
```

แม้คะแนนถูกดึงด้วย A-group specificity (5 ข้อ) แต่ B1/B3/B4/B5 ผ่านทั้งสอง reviewer → เสาหลัก (coverage, approach, scope, risk) ยังแข็ง ปัญหาแก้ได้ในเอกสารเดิม

## Recommended Next Step

**revise and re-validate** — แก้ 2 critical + 10 important ใน PRP (และ PRD เฉพาะจุด 17-caller list) แล้วรีรัน `/prp-validate-plan` ไม่ต้อง re-plan จากศูนย์

> Review-only gate: ไม่ได้แก้ไข plan และไม่ได้เปลี่ยน git state; เขียนเฉพาะรายงานนี้
