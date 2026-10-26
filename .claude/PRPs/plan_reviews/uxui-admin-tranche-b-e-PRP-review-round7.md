# Plan Review (round 7): uxui-admin-tranche-b-e-PRP rev.6

**Skill**: `prp-validate-plan` v2.0.0 (2026-10-25)
**Plan**: `docs/plans/uxui-admin-tranche-b-e-PRP.md` (rev.6)
**Reviewed**: 2026-10-25
**Source PRD**: `docs/plans/uxui-admin-tranche-b-e-PRD.md`
**Findings Input**: none (B7 SKIPPED)
**Review Mode**: dual (context isolation)
**Verdict**: NOT READY
**Confidence Score**: 6/10 — single-pass implementation

## Reviewer Verdicts

| Reviewer | Diversity | Verdict | Critical issues | Important issues |
|---|---|---|---|---|
| A | context isolation | FAIL | 0 | 2 |
| B | context isolation only | FAIL | 0 | 1 |

## Rubric Results (round 7)

| # | Criterion | A | B | Aggregate | Evidence |
|---|---|---|---|---|---|
| A1 | Context Completeness | PASS | PASS | PASS | — |
| A2 | Implementation Readiness | PASS | PASS | PASS | — |
| A3 | Pattern Faithfulness | PASS | PASS | PASS | A/B spot-check 10+ refs ตรง (`use-resource.ts:106/:143`, `reset-rate-limits.ts:16`, `liff-state-redirect.tsx:102`) |
| A4 | Validation Coverage | PASS | PASS | PASS | — |
| A5 | UX Clarity | PASS | PASS | PASS | — |
| A6 | No Prior Knowledge Test | FAIL | PASS | **FAIL** | A: `listFriendEvents` ขัดกันเองระหว่าง `:250` (query) กับ wrapper ④ (friendId) |
| B1 | Spec Coverage | PASS | PASS | PASS | — |
| B2 | Internal Consistency | FAIL | FAIL | **FAIL** | ① signature/count ของ "zero-arg 11 ตัว" (จริง 14 methods, บางตัวมี param อยู่แล้ว) ② role matrix มี `admin` ที่ไม่มีใน `ALL_ROLES` |
| B3 | Technical Soundness | PASS | PASS | PASS | — |
| B4 | Scope Discipline | PASS | PASS | PASS | — |
| B5 | Risk Coverage | PASS | PASS | PASS | — |
| B6 | Testability | PASS | PASS | PASS | — |
| B7 | Finding Coverage | SKIPPED | SKIPPED | SKIPPED | — |

## 🔴 Critical (must fix before implementing)

ไม่มี

## 🟡 Important (should fix)

- **`listFriendEvents` สัญญาขัดกัน** — `:250` จัดให้เป็น zero-arg ที่จะมี signature `(query = '', opts?)` แต่ wrapper ④ (`friend-detail-client.tsx:24`) เรียก `listFriendEvents(friendId, opts)` และ signature จริงคือ `listFriendEvents(friendId?: string)` (`admin-api.ts:478`); `friends-history-client.tsx:22` ส่ง search query เข้า `friendId` อยู่แล้ว → ต้องฟันธง semantics
- **"zero-arg methods ทั้ง 11 ตัว" นับผิด และบางตัวมี param อยู่แล้ว** — ระบุ 13 ชื่อ แต่ `listFriends(query)`, `listBroadcasts(query?)`, `listFriendEvents(friendId?)` มีพารามิเตอร์แรกอยู่ → ต้องแยกกลุ่มให้ชัด
- **role matrix §9 มี `admin` ที่ไม่มีจริง** — `ALL_ROLES = ['citizen','officer','chief','head','superadmin']` (`src/lib/auth/roles.ts:11`); E2E จะ fixture role ที่ไม่มี

## 🟢 Minor / Suggestions

- A รายงานว่า `:179` cite `src/app/admin/users.integration.test.ts` — **ตรวจไฟล์จริงแล้วไม่จริง**: ไฟล์มี `src/app/admin/actions/users.integration.test.ts:132,145` ถูกต้องอยู่แล้ว (finding นี้ไม่ reproduce)
- PRD §5 เขียน "17 callers" vs PRP A11Y-03 "18 (17 production + 1 story)" — align แล้วใน rev.7
- A11Y-01 test contract ควรมี backdrop click (PRD กำหนด), A11Y-03 ควรมี mobile-keyboard viewport
- FORM-01 cite past-guard `:123-126` จริงคือ `:122-126`
- T0 pin Playwright browser version ใน README

## Reviewer Disagreements

- A6: A FAIL / B PASS — A เจาะ conflict ของ `listFriendEvents` ที่ B ไม่ได้ตรวจ
- B2: ทั้งคู่ FAIL แต่ A เห็นเฉพาะ `listFriendEvents` + dead path (ส่วน dead path ไม่จริง), B เห็น count + role matrix
- เสาอื่นผ่านทั้งคู่ (11/13)

## Confidence

```
raw = 10 − 2×1 (A6) − 1×1 (B2) − 1×1 (important เพิ่ม: role matrix) = 6
consensus FAIL → cap 7 → score = 6
```

## Recommended Next Step

**revise and re-validate** — rev.7 แก้ทั้ง 3 important (signature จริงราย method + GOTCHA `listFriendEvents`, role matrix ตาม `ALL_ROLES`, เพิ่ม minors) แล้ว re-validate รอบ 8

> Review-only gate: ไม่ได้แก้ plan และไม่ได้เปลี่ยน git state; เขียนเฉพาะรายงานนี้
