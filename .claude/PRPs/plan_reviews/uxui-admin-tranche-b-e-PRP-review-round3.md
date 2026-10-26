# Plan Review (round 3): uxui-admin-tranche-b-e-PRP rev.2

**Skill**: `prp-validate-plan` v2.0.0 (2026-10-25)
**Plan**: `docs/plans/uxui-admin-tranche-b-e-PRP.md` (rev.2)
**Reviewed**: 2026-10-25
**Source PRD**: `docs/plans/uxui-admin-tranche-b-e-PRD.md`
**Findings Input**: none (B7 SKIPPED)
**Review Mode**: dual (context isolation)
**Verdict**: NOT READY
**Confidence Score**: 1/10 — single-pass implementation (การคำนวณตามสูตร)

## Reviewer Verdicts

| Reviewer | Diversity | Verdict | Critical issues | Important issues |
|---|---|---|---|---|
| A | context isolation | FAIL | 0 | 2 |
| B | context isolation | FAIL | 0 | 6 |

## Rubric Results (round 3)

| # | Criterion | A | B | Aggregate | Evidence |
|---|---|---|---|---|---|
| A1 | Context Completeness | PASS | FAIL | FAIL | B: NET-03 UI row อ้าง "23 ไฟล์ใน evidence ของ PRP รอบแรก" ที่ไม่มีอยู่ในแผนชุดนี้ และ list ปัจจุบันมี 9 path — grep จริงได้ 21 ไฟล์ |
| A2 | Implementation Readiness | PASS | FAIL | FAIL | B: `:257` บังคับไล่ caller เอง; `:150` "ฟอร์มใน case-detail-client (ถ้ายังมี path navigate ออก)" ไม่ระบุว่ามีหรือไม่ |
| A3 | Pattern Faithfulness | PASS | PASS | PASS | A spot-check 30+ refs, B 15+ refs ทั้งคู่ยืนยันเป็นโค้ดจริง (drift เล็ก `ApiFail :13→:14`, `load type :30→:26`) |
| A4 | Validation Coverage | FAIL | FAIL | FAIL | **ไม่มี build command ในด่าน** — PRD §4/PRP §10 มีแค่ tsc/eslint/vitest/check-contrast/verify-env; `package.json:16` มี `build: next build && tsx scripts/verify-env.ts` แต่ไม่ถูกสั่งรัน |
| A5 | UX Clarity | PASS | PASS | PASS | — |
| A6 | No Prior Knowledge Test | PASS | FAIL | FAIL | B: `:257` อ้าง evidence รอบแรกที่ไม่มี; `:150` ไม่ระบุ path navigate-out |
| B1 | Spec Coverage | PASS | FAIL | FAIL | B: PRD FORM-03 บังคับ "pending, success, error ที่มองเห็น" ทุก mutation แต่ PRP §4 FORM-03 ไม่มีงานเพิ่ม success feedback — โค้ดปัจจุบัน `handleToggleActive/handleDelete` สำเร็จแค่ reload เงียบ (`reply-objects-client.tsx:58-80`) |
| B2 | Internal Consistency | FAIL | FAIL | FAIL | (1) `:168` อ้างว่า "มีแต่ `actions/cases.ts` 8 จุดที่สร้าง `?ok=`" — เท็จ: `actions/users.ts:101,164,237,298` + `users.integration.test.ts:132,145` ก็ใช้; (2) `:21,:25` บอก T4 แตะ `broadcast-wizard-client.tsx` แต่ task T4 ไม่แตะ; (3) `:147` กติกา safeInternalPath 4 ข้อไม่ครอบ `..` แต่ test contract `:158` บังคับ |
| B3 | Technical Soundness | PASS | PASS | PASS | — |
| B4 | Scope Discipline | PASS | PASS | PASS | — |
| B5 | Risk Coverage | PASS | PASS | PASS | 8 ความเสี่ยง + mitigation ครบ |
| B6 | Testability | PASS | FAIL | FAIL | B: NET-04 ทั้งบล็อก (error.tsx, pending guards 8 จุด, try/catch 3 action files) ไม่มี test contract; A11Y-02 "ตรวจ class หรือ visual" คลุมเครือ; FLOW-01 expected "ซ่อนหรืออ่านอย่างเดียว" ไม่ฟันธง |
| B7 | Finding Coverage | SKIPPED | SKIPPED | SKIPPED | — |

## 🔴 Critical

ไม่มี

## 🟡 Important (ควรแก้ก่อนลงมือ)

- **A4:** ไม่มี `npx next build` ในด่าน — ต้องมีเพราะแก้ error.tsx ใหม่, ลบ export `SuccessToast`, เปลี่ยน return shape server action, เพิ่ม `inert` — มีแต่ `verify-env.ts` ซึ่งอยู่ใน build อยู่แล้วแต่ไม่ compile ตัว Next เอง
- **B2 `?ok=` overclaim:** ข้อความ `:168` ต้องแคบลงเป็น "cases เท่านั้น; `actions/users.ts` มี `?ok=` ของหน้า users ซึ่งไม่แตะ" กัน dev สับสนตอน grep
- **B2 T4 note ผิด:** `:21,:25` บอก T4 แตะ `broadcast-wizard-client.tsx` แต่ §7 ไม่มีงานนั้น → แก้เป็น `users-client.tsx` + `reply-objects-client.tsx` เท่านั้น
- **B2 safeInternalPath:** กติกา 4 ข้อ (`:147`) ไม่ครอบ `..` ที่ test contract (`:158`) บังคับ — ต้องเพิ่ม rule "ห้าม path segment `..`" (ตัวอย่าง liff `:61-67` ก็ไม่เช็ค `..`)
- **B1 FORM-03 ขาด success feedback:** PRD บังคับ pending/success/error ทุก mutation แต่ PRP ไม่มีงานเพิ่ม success banner ของ create/update/toggle/delete
- **A1/A2/A6 NET-03 UI sweep:** อ้าง "23 ไฟล์" ที่ไม่มีอยู่ — ต้อง enumerate รายชื่อ `useResource(` callers ทั้ง 21 production ไฟล์ลงแผน + เกณฑ์ตัดสิน empty-vs-error รายหน้า
- **B6 NET-04 ไม่มี test contract** — เพิ่ม input/expected pairs สำหรับ `error.tsx`, pending guards, try/catch
- **B6 FLOW-01/A11Y-02 expected คลุมเครือ** — ฟันธงผลเดียว (read-only) และระบุ selector/class assertion

## 🟢 Minor / Suggestions

- แก้ `ApiFail :13` → `:14` (มีแล้วใน rev.2 แต่ A เห็นว่าบางจุดยัง `:13` ค้าง); `load type :30` → `:26` (B)
- ตัด/ตัดสิน FLOW-03 hidden input `return` ถ้าไม่มี navigate-out หลัง FLOW-04
- แก้ T0 เกณฑ์ 3 "แก้ชั่วคราวแล้ว revert" ให้เป็น "fixture ที่ไม่ใช่ protected"
- Risk "E2E ?ok= ไม่ตรง" — จริง ๆ ไม่มี e2e spec ไหน assert `?ok=` (grep แล้วว่าง) → เปลี่ยนเป็น "ตรวจ `users.integration.test.ts` ห้ามโดน"
- A11Y-02/03 เสริม expected ที่วัดได้ (selector/class assertion; dialog ทดสอบตัวไหน, viewport ใด)
- ระบุ `currentUrl` ใน reports มาจาก searchParams reconstruct ฝั่ง server
- ระบุ position ของ `actionError` render ใน users page และข้อความ impact ใน ConfirmDialog (PRD FORM-02)

## Reviewer Disagreements

- **A1/A2/A6, B6:** B ให้ FAIL, A ให้ PASS — B ค้นลึกกว่า (เจาะ NET-03 UI ที่ citation เสีย) → aggregate FAIL
- **B1:** A PASS / B FAIL — B เจาะว่า PRD บังคับ success feedback แต่ PRP ไม่มีงานนั้น
- **B2:** ทั้งคู่ FAIL — A เจาะ `?ok=` overclaim, B เจาะเพิ่ม safeInternalPath + T4 note

## Confidence

```
raw = 10 − 2×4 (A1,A2,A4,A6) − 1×3 (B1,B2,B6) − 1×0 (no additional Important) = −1 → 1
consensus FAIL → 1
```

**แนวโน้ม converge ชัดเจน:** เสา A3/A5/B3/B4/B5 ผ่านทั้งคู่ตลอด 3 รอบ; ที่เหลือเป็น documentation precision ไม่ใช่ architectural gap — แก้รอบเดียวได้หมด

## Recommended Next Step

**revise and re-validate** — แก้ 8 ข้อ Important ในเอกสารเดิม (ไม่ต้อง re-plan)

> Review-only gate: ไม่ได้แก้ plan และไม่ได้เปลี่ยน git state; เขียนเฉพาะรายงานนี้
