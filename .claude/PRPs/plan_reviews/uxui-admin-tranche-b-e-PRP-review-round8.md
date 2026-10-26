# Plan Review (round 8): uxui-admin-tranche-b-e-PRP rev.7

**Skill**: `prp-validate-plan` v2.0.0 (2026-10-25)
**Plan**: `docs/plans/uxui-admin-tranche-b-e-PRP.md` (rev.7)
**Reviewed**: 2026-10-25
**Source PRD**: `docs/plans/uxui-admin-tranche-b-e-PRD.md`
**Findings Input**: none (B7 SKIPPED)
**Review Mode**: dual (context isolation)
**Verdict**: NOT READY
**Confidence Score**: 1/10 — single-pass implementation

## Reviewer Verdicts

| Reviewer | Diversity | Verdict | Critical issues | Important issues |
|---|---|---|---|---|
| A | context isolation | FAIL | 1 | 2 |
| B | context isolation only | FAIL | 0 | 1 |

## Rubric Results (round 8)

| # | Criterion | A | B | Aggregate | Evidence |
|---|---|---|---|---|---|
| A1 | Context Completeness | PASS | PASS | PASS | — |
| A2 | Implementation Readiness | FAIL | PASS | **FAIL** | signature ไม่ typecheck กับ load type |
| A3 | Pattern Faithfulness | PASS | PASS | PASS | ทั้งคู่ spot-check 10+ refs ตรง |
| A4 | Validation Coverage | PASS | PASS | PASS | — |
| A5 | UX Clarity | PASS | PASS | PASS | — |
| A6 | No Prior Knowledge Test | FAIL | PASS | **FAIL** | A: `error` ไม่มีอยู่จริง + signature mismatch |
| B1 | Spec Coverage | PASS | PASS | PASS | — |
| B2 | Internal Consistency | FAIL | FAIL | **FAIL** | "เติม opts พารามิเตอร์ที่สองเสมอ" ขัด `listIntents(opts?)` ตัวเดียว |
| B3 | Technical Soundness | FAIL | PASS | **FAIL** | A: strictFunctionTypes ทำให้ signature ไม่ compile |
| B4 | Scope Discipline | PASS | PASS | PASS | — |
| B5 | Risk Coverage | PASS | PASS | PASS | — |
| B6 | Testability | PASS | PASS | PASS | — |
| B7 | Finding Coverage | SKIPPED | SKIPPED | SKIPPED | — |

## 🔴 Critical (must fix before implementing)

- **`adminApi` signature table ทำให้ tsc ไม่ผ่าน** — rev.7 กำหนด `listIntents(opts?)` (opts เป็นพารามิเตอร์แรก) แต่ load type คือ `(query: string, opts?: { signal? })` → tsconfig `strict:true` + `strictFunctionTypes` ปฏิเสธ assignment → `load: adminApi.listIntents` (intent-section.tsx:70, rich-menus-client.tsx:25, settings-client.tsx:25) fail `npx tsc --noEmit` — แก้โดยให้ zero-arg methods มี query slot: `(query = '', opts?)` ให้ตรงกับพารามิเตอร์แรกของ load type

## 🟡 Important (should fix)

- **`UseResourceResult` ไม่มี `error` field อยู่จริง** — ทั้ง A และ B เห็นตรงกัน: `use-resource.ts:33-46` expose แค่ `data/loading/feedback/notify/clearFeedback/reload/mutate/setData` (error ไปทาง `feedback` ที่ auto-clear `:80-88`); plan เขียนว่า "คงเดิม" แต่ต้องเป็น **field ใหม่** พร้อม set/clear rules
- **test `use-resource.test.ts:159-172`** — ต้องระบุชัดว่า assertion ที่เปลี่ยนคือ "error หายใน 4s" ไม่ใช่ "feedback หายใน 4s" (success ยัง auto-clear ตาม `FEEDBACK_MS`)

## 🟢 Minor / Suggestions

- `data === null && error` → `data === null && error && !loading` (กัน error โผล่ระหว่าง request แรก)
- line `reply-objects-client.tsx:198` จะขยับหลัง T1 แตะไฟล์นี้ — ใช้ selector `max-h-` แทน line number
- `searchParams.return` คืน `string | string[] | undefined` — ระบุว่าใช้ค่าแรกหรือ reject array
- T0 pin case id ที่ capture ลง `docs/baseline/README.md`
- A5 เพิ่ม before→after one-liner ต่อ task (หรือ mark internal-only ว่า N/A)

## Reviewer Disagreements

- A2/A6/B2/B3: A FAIL / B PASS — A เจาะ type system ลึกกว่า; B ตรวจ inventory ตรงแต่ไม่ได้ run mental `strictFunctionTypes`
- เสาอื่นผ่านทั้งคู่ (9/13)

## Confidence

```
raw = 10 − 2×2 (A2, A6) − 1×2 (B2, B3) − 1×2 (important 2 ตัว: error field, test assert) = 0 → 1
consensus FAIL → cap 7 → score = 1
```

**บทเรียนต่อเนื่อง:** rev.7 พยายามแก้ปัญหา "zero-arg 11 ตัว" แต่เขียน signature ไม่ typecheck — แก้แล้วปัญหาใหม่กว่าเดิม รอบ 8 ต้อง pin type contract ให้ compile ได้จริงก่อนคิดเรื่อง inventory

## Recommended Next Step

**revise and re-validate** — rev.8 แก้ critical signature (query slot ทุก zero-arg method) + important error field (ระบุเป็น field ใหม่ชัดเจน) + minor 4 ข้อ แล้ว re-validate รอบ 9

> Review-only gate: ไม่ได้แก้ plan (rev.8 เกิดหลัง review จบ) และไม่ได้เปลี่ยน git state; เขียนเฉพาะรายงานนี้
