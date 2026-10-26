# Plan Review (round 2): uxui-admin-tranche-b-e-PRP rev.1

**Skill**: `prp-validate-plan` v2.0.0 (2026-10-25)
**Plan**: `docs/plans/uxui-admin-tranche-b-e-PRP.md` (rev.1 — หลังแก้รอบแรก)
**Reviewed**: 2026-10-25
**Source PRD**: `docs/plans/uxui-admin-tranche-b-e-PRD.md`
**Findings Input**: none (B7 SKIPPED)
**Review Mode**: dual (context isolation — ไม่มี model diversity)
**Verdict**: NOT READY
**Confidence Score**: 1/10 — single-pass implementation

## Reviewer Verdicts

| Reviewer | Diversity | Verdict | Critical issues | Important issues |
|---|---|---|---|---|
| A | context isolation | FAIL | 1 | 4 |
| B | context isolation | FAIL | 0 | 5 |

## Rubric Results (round 2)

| # | Criterion | A | B | Aggregate | Evidence |
|---|---|---|---|---|---|
| A1 | Context Completeness | PASS | PASS | PASS | รอบแรกตก (17 callers/list/test file) — rev.1 เพิ่มครบ ทั้งคู่ผ่าน |
| A2 | Implementation Readiness | FAIL | FAIL | FAIL | FLOW-04 return shape ขัด `CaseActionState` (จริง `{ error; success? }`); FORM-02 `state.error` หลังถอด `useActionState`; NET-03 abort signal ไม่บอกวิธี thread ผ่าน `load` signature/29 call site; FORM-01 send-now ไม่ระบุ payload |
| A3 | Pattern Faithfulness | PASS | PASS | PASS | ทั้งคู่ spot-check แล้วไม่มี dead ref (มี off-by-one เล็กน้อย `ApiFail` :13→:14 — suggestion) |
| A4 | Validation Coverage | PASS | PASS | PASS | tsc/eslint/vitest/check-contrast/verify-env + build ครบใน package.json |
| A5 | UX Clarity | PASS | PASS | PASS | before/after ทุก task |
| A6 | No Prior Knowledge Test | FAIL | FAIL | FAIL | จุดเดา: FORM-01 TZ contract, FLOW-04 field name, FORM-02 error storage, send-now payload |
| B1 | Spec Coverage | FAIL | PASS | FAIL | A: NET-03 บอก "ทุกหน้า" แต่ task ไล่ 6-8 ไฟล์ — `canned-responses-client.tsx:43,155-158` ยังโชว์ empty แทน error |
| B2 | Internal Consistency | FAIL | FAIL | FAIL | return `{ok,message}` ขัด `CaseActionState`; `state.error` ขัดการถอด useActionState; send-now payload ไม่ระบุ; FORM-01 expected ขัด test จริง `:193` (regex ทน offset) |
| B3 | Technical Soundness | FAIL | PASS | FAIL | A: FORM-01 expected `'2030-01-01T10:00:00.000Z'` จาก `datetime-local` local time — บน Asia/Bangkok ได้ `03:00Z` (test แดง/ถ้าแก้โค้ดตาม = broadcast คลาด 7 ชม.); ไม่มี Safari <17.4 note สำหรับ `AbortSignal.any/timeout` |
| B4 | Scope Discipline | PASS | PASS | PASS | — |
| B5 | Risk Coverage | PASS | PASS | PASS | ตาราง 7 ข้อ |
| B6 | Testability | FAIL | PASS | PASS→FAIL | A: คู่ TZ-dependent ใช้ไม่ได้จริง + ขาด abort test pair; B ให้ PASS (ค่าผิดอยู่ที่ B2) — aggregate FAIL |
| B7 | Finding Coverage | SKIPPED | SKIPPED | SKIPPED | — |

## 🔴 Critical (must fix before implementing)

1. **FORM-01 test contract ผิดฟิสิกส์เวลา** — ระบุ input `scheduleAt='2030-01-01T10:00'` (datetime-local, local time) คาด `=== '2030-01-01T10:00:00.000Z'` — บน Asia/Bangkok `new Date().toISOString()` ได้ `'2030-01-01T03:00:00.000Z'` ไม่ตรง; vitest ไม่ pin TZ; test เดิม `broadcast-wizard-client.test.tsx:193` ตั้งใจใช้ regex ทน offset — ถ้า implementer "แก้โค้ด" ให้ตรง expected → scheduled broadcast คลาด ~7 ชม. จริง

## 🟡 Important (should fix)

- FLOW-04 `return { ok: true, message }` ขัด `CaseActionState` (`{ error: string | null; success?: string }` จริง) — ต้องตัดสิน shape เดียว อัปเดต 8 action + `initialActionState` + client ที่อ่าน `.error` (`case-detail-client.tsx:308`)
- FORM-02 แถวเดียวกันสั่ง "แสดง `state.error`" และ "ไม่ใช้ `useActionState`" — `state` เป็นของ hook ที่ถอดออก ต้องระบุ `useState` คู่กับ pending
- NET-03 abort threading: `load: (query) => Promise<ApiResult>` (use-resource.ts:30) ไม่มีช่องส่ง signal; แผนสั่ง `AbortSignal.any` แต่ไม่บอกวิธีเปลี่ยน signature/กระทบ call site
- NET-03 UI ไม่ครบ: `canned-responses-client.tsx:43,155-158` (และหน้า `useResource` ที่เหลือ) ยัง empty แทน error
- Safari <17.4: `AbortSignal.timeout/any` โยน TypeError — ต้องมี fallback แบบมี feature detect (มีให้ `inert` แล้ว แต่ตัวนี้กระทบ request ชั้นเดียวทั้งระบบ)
- FLOW-03 "generalize จาก `liff-state-redirect.tsx:61-67`" — ไฟล์นั้น protected (PRD §3) ต้องเขียนชัดว่าคัดลอก logic ไปเขียนใหม่ ห้ามแก้ไฟล์เดิม
- FORM-01 mode `'send-now'` ไม่ระบุ payload `scheduledAt` (confirm บอก "ยกเลิกเวลาที่ตั้งไว้" → ควร `null`)

## 🟢 Minor / Suggestions

- `ApiFail` อ้าง `:13` → `:14` (บรรทัด 13 คือ `ApiOk`)
- T0: ทดสอบ gate ด้วยไฟล์ fixture ที่ไม่ protected แทนการแก้ `.landing` (hard gate ห้ามแตะ protected แม้ชั่วคราว)
- §1 diagram วาด T1→T2 เป็นสาย แต่ข้อความบอกขนาน — วาดเป็น parallel lane
- นับ "17 caller" แต่ list มี 18 (17 production + stories) — แก้ตัวเลข
- ตัดสินเรื่อง `searchParams.ok`/`SuccessToast` ในแผน (grep ได้ทันที) ไม่ใช่ทิ้งใน PR body

## Reviewer Disagreements

- **B1**: A FAIL (canned-responses ขาด) / B PASS (เกณฑ์รายรหัสผ่าน) → aggregate FAIL
- **B3, B6**: A FAIL / B PASS — A เจาะ TZ contract กับ abort pair; B ถือว่าค่าผิดอยู่ใน B2 แล้ว → aggregate FAIL

## Confidence

```
raw = 10 − 2×2 (A2,A6) − 1×4 (B1,B2,B3,B6) − 1×1 (liff-protected important) = 1
consensus FAIL → min(…,7) = 1
```

## Recommended Next Step

**revise and re-validate** — critical 1 ตัว + important 7 ตัวแก้ได้ในเอกสารเดิม (เสา B4/B5/A1/A3/A4/A5 ผ่านทั้งคู่แล้ว)

> Review-only gate: ไม่ได้แก้ไข plan และไม่ได้เปลี่ยน git state; เขียนเฉพาะรายงานนี้
