# Plan Review (round 6): uxui-admin-tranche-b-e-PRP rev.5

**Skill**: `prp-validate-plan` v2.0.0 (2026-10-25)
**Plan**: `docs/plans/uxui-admin-tranche-b-e-PRP.md` (rev.5)
**Reviewed**: 2026-10-25
**Source PRD**: `docs/plans/uxui-admin-tranche-b-e-PRD.md`
**Findings Input**: none (B7 SKIPPED)
**Review Mode**: dual (context isolation)
**Verdict**: NOT READY
**Confidence Score**: 7/10 — single-pass implementation (cap 7 ตาม consensus FAIL)

## Reviewer Verdicts

| Reviewer | Diversity | Verdict | Critical issues | Important issues |
|---|---|---|---|---|
| A | context isolation | PASS | 0 | 0 |
| B | context isolation only | FAIL | 0 | 2 |

## Rubric Results (round 6)

| # | Criterion | A | B | Aggregate | Evidence |
|---|---|---|---|---|---|
| A1 | Context Completeness | PASS | PASS | PASS | — |
| A2 | Implementation Readiness | PASS | PASS | PASS | inventory 14 methods + 6 wrapper ตรง grep ทั้งคู่ |
| A3 | Pattern Faithfulness | PASS | PASS | PASS | A spot-check 15+, B spot-check 30+ refs ตรง |
| A4 | Validation Coverage | PASS | PASS | PASS | scripts ครบ |
| A5 | UX Clarity | PASS | PASS | PASS | — |
| A6 | No Prior Knowledge Test | PASS | PASS | PASS | — |
| B1 | Spec Coverage | PASS | PASS | PASS | — |
| B2 | Internal Consistency | PASS | **FAIL** | **FAIL** | (1) `code` ไม่มีที่มาใน `UseResourceResult` (2) A11Y-02 assertion target ผิด |
| B3 | Technical Soundness | PASS | PASS | PASS | `superRefine`, Safari fallback, `use-resource.ts` 2 load call sites ตรง |
| B4 | Scope Discipline | PASS | PASS | PASS | — |
| B5 | Risk Coverage | PASS | PASS | PASS | — |
| B6 | Testability | PASS | PASS | PASS | (A11Y-02 target ผิด — อยู่ใน B2) |
| B7 | Finding Coverage | SKIPPED | SKIPPED | SKIPPED | — |

## 🔴 Critical (must fix before implementing)

ไม่มี

## 🟡 Important (should fix)

- **`UseResourceResult` ไม่กำหนด field `code`** — §7 AdminErrorState จะ branch ที่ `code === 'SESSION_EXPIRED'` แต่บรรทัด "expose `error`" ไม่เพิ่ม type เปลี่ยนแปลงของ `UseResourceResult` → ต้อง pin เป็น `error: string | null` + **`errorCode?: ApiFail['code']`** (บรรทัดใหม่) ให้ test contract 252-253 ระบุที่อยู่ของ `code` ได้
- **A11Y-02 assertion target ผิด** — change ที่ `:93` ใส่ class บน wrapper `<div>` แต่ test contract บอก "assert class ที่ element ปุ่ม" — ไม่มี `<button>` ตัวไหนแบก `opacity-100` หรือ variant class เหล่านั้น → ต้อง assert ที่ wrapper div ตาม class string `focus-within:opacity-100` / `pointer-coarse:opacity-100`

## 🟢 Minor / Suggestions

- "นอกเหนือจากนี้ไม่ต้องแก้" แคบลงเป็น "นอกเหนือจาก 14 ตัว + `getBroadcast`/`getFriend`/`getIntent`" — ไม่เช่นนั้น wrapper ①②③ ที่เพิ่ม `opts` จะขัดกับประโยค
- `use-resource.ts:107` → `:106` (reload) และระบุ `:143` (effect runner) ด้วย
- FORM-01 past-time guard (`broadcast-wizard-client.tsx:123-126`) ระบุว่าใช้เฉพาะ `mode='schedule'` — ไม่เช่นนั้น send-now ที่มีเวลาค้างจะถูกบล็อกขัด test
- FORM-02 per-row error ต้องมี identity — เพิ่ม `actionErrorUserId: string | null`
- FLOW-01 ระบุว่า `canChangeBudget`/`canChangeBudgetAmount`/`canChangeActionDetails` เป็น prop ใหม่ (หรือรวมเป็น `canSupervise` ตัวเดียว — ทั้ง 4 gate ใช้ `CASE_SUPERVISOR_ROLES` เดียวกัน)

## Reviewer Disagreements

- B2: A PASS / B FAIL — B เจาะ type ที่ขาด (`code`) + assertion target; A ไม่ได้เช็ค 2 จุดนี้
- เสาอื่นผ่านทั้งคู่

## Confidence

```
raw = 10 − 2×0 (A) − 1×1 (B2) − 1×0 (important 2 ตัวอยู่ใน B2 แล้ว หักซ้ำ) = 9
consensus FAIL → cap 7 → score = 7
```

**แนวโน้ม:** 4 → 1 → 7 — หลัง inventory มาจาก grep จริง เสา 12/13 ผ่านแล้ว เหลือ type ที่ขาด 1 จุด + assertion target 1 จุด

## Recommended Next Step

**revise and re-validate** — แก้ important 2 + minor 5 ใน rev.6 แล้ว re-validate รอบ 7

> Review-only gate: ไม่ได้แก้ plan และไม่ได้เปลี่ยน git state; เขียนเฉพาะรายงานนี้
