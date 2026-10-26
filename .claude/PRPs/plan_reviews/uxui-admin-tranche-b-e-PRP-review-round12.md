# Plan Review (round 12): uxui-admin-tranche-b-e-PRP rev.10

**Skill**: `prp-validate-plan` v2.0.0 (2026-10-26)
**Plan**: `docs/plans/uxui-admin-tranche-b-e-PRP.md` (rev.10)
**Reviewed**: 2026-10-26
**Source PRD**: `docs/plans/uxui-admin-tranche-b-e-PRD.md`
**Findings Input**: none (B7 SKIPPED)
**Review Mode**: dual — Reviewer A ล้ม 2 ครั้ง (stall watchdog + rate limit) → **LIMITED REVIEW**

**Verdict**: NOT READY
**Confidence Score**: 5/10 (capped — limited mode)

## Reviewer Verdicts

| Reviewer | Diversity | Verdict | Critical issues | Important issues |
|---|---|---|---|---|
| A | context isolation | N/A (ล้ม 2 ครั้ง: stall + 503) | — | — |
| B | context isolation only | FAIL | **2** | 9 |

## Rubric Results (round 12 — B เท่านั้น)

| # | Criterion | B | Evidence |
|---|---|---|---|
| A1 | Context Completeness | FAIL | T0 อ้าง seed case ที่ไม่มี + ไม่มี app server prerequisite |
| A2 | Implementation Readiness | FAIL | 7 rows ขาด MIRROR/VALIDATE; `error.tsx` ขาด `'use client'` |
| A3 | Pattern Faithfulness | PASS | spot-check 12+ refs ตรง (±2 บรรทัด) |
| A4 | Validation Coverage | PASS | scripts ครบ |
| A5 | UX Clarity | PASS | (ยกเว้น Thai copy A11Y-04) |
| A6 | No Prior Knowledge Test | FAIL | seed case / app server / theme switch / `use client` / rollout scope |
| B1 | Spec Coverage | PASS | — |
| B2 | Internal Consistency | FAIL | §1 `:39` ขัดกับ §7 file surface |
| B3 | Technical Soundness | PASS | — |
| B4 | Scope Discipline | PASS | — |
| B5 | Risk Coverage | FAIL | mitigation "seed คงที่" เป็นเท็จ |
| B6 | Testability | PASS | — |
| B7 | Finding Coverage | SKIPPED | — |

## 🔴 Critical (must fix before implementing)

1. **T0 อ้าง seed case ที่ไม่มีอยู่จริง** — plan `:70` บอก `/admin/cases/[id]` (1 เรื่อง seed, id แรกที่ `seed.ts` สร้าง) แต่ `grep -c "insert(cases)" scripts/seed.ts` = **0** (seed มีแค่ departments `:78`, categories `:220`, users `:255`) → T0 gate รันไม่ได้ deterministic; false premise เดียวกันโผล่ที่ `:72` และ `:350`
2. **T0 ขาด runtime prerequisite** — `scripts/capture-baseline.ts` เป็น standalone Playwright ที่ต้องมี Next server รันอยู่ แต่ `:83` Dependencies มีแค่ Docker + drizzle push + seed ไม่มี `npx next dev`

## 🟡 Important (should fix)

- `:39` "T4 แตะ users-client.tsx, reply-objects-client.tsx เท่านั้น" ขัดกับ §7 (T4 แก้ admin-api.ts, use-resource.ts, 2 test, admin-error-state.tsx, error.tsx, 19 rollout files, 5 action files)
- rev.10 ประกาศว่าทุก row มีป้ายครบ — จริง ๆ `:95`, `:110`, `:125`, `:126`, `:127`, `:315`, `:316` มีแค่ ACTION+IMPLEMENT
- bare `:NN` VALIDATE pointers ชี้ผิดบรรทัดทุกจุด (ตัวเอง drift ตาม revision)
- `error.tsx` ขาด `'use client'` — Next 16 error boundary ต้องเป็น client component ไม่งั้น build fail
- AdminErrorState rollout scope ขัดกัน: `:279` "7 ไฟล์ rewrite จริง" vs `:314` "ทุก 19 ไฟล์ต้อง render 2 variant"
- dark-theme screenshot ไม่มีกลไกสลับ — `src/app/layout.tsx:90` hardcode `data-theme="light"`
- timeout vs caller-abort แยกไม่ได้จาก plan — unmount abort ก็ reject fetch
- `:73` T0 acceptance ใช้คำ "protected path" ปนกับ "captured routes" — screenshot diff script เฝ้า source path ไม่ได้
- FLOW-03 e2e pointer ผิด: `:169` cite back link `:173` จริงคือ `:181-187`

## 🟢 Minor / Suggestions

- rev.9 อ้าง skeleton `admin-error-state.tsx` แต่มีแค่ประโยค props
- `use-resource.ts:4` import แค่ `ApiResult` — ต้องเพิ่ม `ApiFail` type import
- `/admin/reports` มี `formatAge(Date.now())` (`page.tsx:35-40`) → byte-identical 2 รอบเป็นไปไม่ได้ ต้องยกเว้น/crop
- T0 ควรมี branch/PR ของตัวเองตาม AGENTS.md
- "14 direct + 6 wrapper" นับ call-site ไม่ใช่ไฟล์
- A11Y-04 ไม่มี Thai copy จริง
- FORM-01 cite `handleCreate()` `:128-133` จริงเริ่ม `:111`

## Reviewer Disagreements

- ไม่มี (A ล้ม → limited review)

## Confidence

```
LIMITED REVIEW → score = min(raw, 5) = 5
```

**หมายเหตุ:** B เจอ critical ที่ A ไม่เคยเจอใน 11 รอบก่อน — เพราะรอบนี้ B ตรวจ `scripts/seed.ts` จริงแทนที่จะเชื่อข้อความในแผน

## Recommended Next Step

**revise and re-validate** — rev.11 แก้ critical 2 (T0 seed case + app server), important 9, แล้ว re-validate รอบ 13 ด้วย dual review (ต้องได้ A กลับมาด้วย)

> Review-only gate: ไม่ได้แก้ plan และไม่ได้เปลี่ยน git state; เขียนเฉพาะรายงานนี้
