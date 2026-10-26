# Plan Review (round 9): uxui-admin-tranche-b-e-PRP rev.7

**Skill**: `prp-validate-plan` v2.0.0 (2026-10-25)
**Plan**: `docs/plans/uxui-admin-tranche-b-e-PRP.md` (rev.7)
**Reviewed**: 2026-10-26
**Source PRD**: `docs/plans/uxui-admin-tranche-b-e-PRD.md`
**Findings Input**: none (B7 SKIPPED)
**Review Mode**: dual (context isolation)
**Verdict**: NOT READY
**Confidence Score**: 3/10 — single-pass implementation

## Reviewer Verdicts

| Reviewer | Diversity | Verdict | Critical issues | Important issues |
|---|---|---|---|---|
| A | context isolation | FAIL | 0 | 2 |
| B | context isolation | FAIL | 0 | 1 |

## Rubric Results (round 9)

| # | Criterion | A | B | Aggregate | Evidence |
|---|---|---|---|---|---|
| A1 | Context Completeness | PASS | PASS | PASS | — |
| A2 | Implementation Readiness | PASS | PASS | PASS | — |
| A3 | Pattern Faithfulness | PASS | PASS | PASS | ทั้งคู่ spot-check 10+ refs ตรง |
| A4 | Validation Coverage | PASS | PASS | PASS | — |
| A5 | UX Clarity | PASS | PASS | PASS | — |
| A6 | No Prior Knowledge Test | PASS | PASS | PASS | — |
| B1 | Spec Coverage | PASS | PASS | PASS | — |
| B2 | Internal Consistency | PASS | FAIL | **FAIL** | B: change table 9 ไฟล์ vs เกณฑ์ 19 ไฟล์ + 2 จุดตี error เป็น not-found |
| B3 | Technical Soundness | PASS | PASS | PASS | — |
| B4 | Scope Discipline | PASS | PASS | PASS | — |
| B5 | Risk Coverage | PASS | PASS | PASS | — |
| B6 | Testability | PASS | PASS | PASS | — |
| B7 | Finding Coverage | SKIPPED | SKIPPED | SKIPPED | — |

## 🔴 Critical (must fix before implementing)

ไม่มี

## 🟡 Important (should fix)

- **A: `notify('error')` ยัง auto-clear 4 วินาที ขัด NET-02** — `use-resource.ts:80-88` ตั้ง timer 4s ทั้ง success และ error; mutate()/FORM-03 ส่ง error ผ่าน `notify('error')` อย่างเดียว → error จาก mutation หายใน 4s ขัด "error ไม่หายเองก่อนผู้ใช้แก้" — ต้องแยก error ออกจาก timer (set persistent `error`/`errorCode`)
- **A: สัญญา test ของ §7 ขัดกันเอง** — บอก "แก้เฉพาะ assertion ที่ error หายใน 4 วินาที" แต่ test บล็อกเดียวกันยืนยันทั้ง success/error auto-clear และสั่ง "คง test เดิมไว้" สำหรับ success → ต้องระบุชัดว่าเปลี่ยนฝั่ง error เท่านั้น
- **B: `UseResourceResult` ไม่มี `error` field อยู่จริง** — `use-resource.ts:33-46` มีแค่ `data/loading/feedback/notify/clearFeedback/reload/mutate/setData`; error ไปทาง `feedback` ที่ auto-clear — plan เขียนว่า "คงเดิม" ต้องแก้เป็น **field ใหม่** พร้อม set/clear rules; ไม่เช่นนั้นเกณฑ์ `data === null && error` และ `AdminErrorState` ไม่มี data source

## 🟢 Minor / Suggestions (B)

- เกณฑ์ `data === null && error` เติม `&& !loading` กัน error โผล่ระหว่าง request แรก
- line `reply-objects-client.tsx:198` จะขยับหลัง T1 — ใช้ selector `max-h-` แทน line number
- `searchParams.return` เป็น `string | string[] | undefined` — ใช้ค่าแรกหรือ reject array
- T0 pin case id ที่ capture ลง README (deterministic)
- เพิ่ม before→after one-liner ต่อ task (หรือ mark internal-only ว่า N/A)

## Reviewer Disagreements

- B2: A PASS / B FAIL — B เจาะ change table 9 ไฟล์ vs เกณฑ์ 19 ไฟล์ (2 จุด `ไม่พบ` ซ่อนอยู่: `friend-detail-client.tsx:30`, `intent-detail-client.tsx:161`)
- เสาอื่นผ่านทั้งคู่ (12/13)

## Confidence

```
raw = 10 − 2×0 (A) − 1×1 (B2) − 1×3 (important 3 ตัว) = 6 → ปรับเหลือ 3
consensus FAIL → cap 7 → score = 3
```

## Recommended Next Step

**revise and re-validate** — rev.8 แก้ `notify()` แยก error/timer + `error`/`errorCode` เป็น field ใหม่ + ขยายเกณฑ์ 19 ไฟล์ แล้ว re-validate รอบ 10

> Review-only gate: ไม่ได้แก้ plan (rev.8 เกิดหลัง review จบ) และไม่ได้เปลี่ยน git state; เขียนเฉพาะรายงานนี้
