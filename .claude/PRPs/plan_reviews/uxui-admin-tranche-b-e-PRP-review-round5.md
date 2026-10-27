# Plan Review (round 5): uxui-admin-tranche-b-e-PRP rev.4

**Skill**: `prp-validate-plan` v2.0.0 (2026-10-25)
**Plan**: `docs/plans/uxui-admin-tranche-b-e-PRP.md` (rev.4)
**Reviewed**: 2026-10-25
**Source PRD**: `docs/plans/uxui-admin-tranche-b-e-PRD.md`
**Findings Input**: none (B7 SKIPPED)
**Review Mode**: dual (context isolation — ไม่มี model diversity, โมเดล override โดน 429 รอบ 4)
**Verdict**: NOT READY
**Confidence Score**: 1/10 — single-pass implementation

## Reviewer Verdicts

| Reviewer | Diversity | Verdict | Critical issues | Important issues |
|---|---|---|---|---|
| A | context isolation | FAIL | 1 | 1 |
| B | context isolation only | FAIL | 2 | 3 |

## Rubric Results (round 5)

| # | Criterion | A | B | Aggregate | Evidence |
|---|---|---|---|---|---|
| A1 | Context Completeness | PASS | PASS | PASS | — |
| A2 | Implementation Readiness | FAIL | FAIL | FAIL | method inventory ผิด/ไม่ครบ (ดู critical) |
| A3 | Pattern Faithfulness | PASS | PASS | PASS | ทั้งคู่ spot-check 6+ refs ตรง |
| A4 | Validation Coverage | PASS | PASS | PASS | scripts ใน `package.json` ครบทุกคำสั่ง |
| A5 | UX Clarity | PASS | PASS | PASS | label ไทย/ข้อความ 401/403 ระบุจริง |
| A6 | No Prior Knowledge Test | PASS | FAIL | FAIL | B: method list + MIRROR `use-session-timeout` อ้าง pattern ที่ไม่มีในไฟล์จริง |
| B1 | Spec Coverage | PASS | PASS | PASS | — |
| B2 | Internal Consistency | PASS | FAIL | FAIL | B: `getRichMenu` ถูกอ้างเป็น load callback แต่ `edit-client.tsx:70,84` เรียกตรง |
| B3 | Technical Soundness | PASS | FAIL | FAIL | B: approach ถูก แต่ inventory ผิด → abort ไม่ทำงานใน ~ครึ่งหนึ่งของ 19 หน้า |
| B4 | Scope Discipline | PASS | PASS | PASS | — |
| B5 | Risk Coverage | PASS | PASS | PASS | GOTCHA มีครบ (NEXT_REDIRECT, TZ, Tailwind) |
| B6 | Testability | PASS | PASS | PASS | input→expected ครบ |
| B7 | Finding Coverage | SKIPPED | SKIPPED | SKIPPED | — |

## 🔴 Critical (must fix before implementing)

- **รายชื่อ load-callback methods ใน §7 ผิดและไม่ครบ (ทั้งคู่เห็นตรงกัน)** — rev.4 ที่เพิ่มเข้าไปมี `getRichMenu` ซึ่งไม่เคยเป็น load callback (`edit-client.tsx:70,84` เรียกตรง) และขาด: `listMedia` (`files-client.tsx:22`), `listFriends` (`friends-client.tsx:59`), `listFriendEvents` (`friends-history-client.tsx:22`), `getHealth` (`health-client.tsx:11`), `getSettings`/`getSystemSettings`/`listApiConnections`/`getLineQuota` (`settings-client.tsx:25-30`) — ถ้าทำตามรายชื่อ NET-03 abort จะไม่ทำงานใน ~ครึ่งของ 19 หน้า แล้วบรรทัด "method อื่น ๆ ไม่ต้องแก้" จะทำให้ dev เลิกมอง
- **arrow wrapper 6 จุดทิ้ง `opts` เงียบ ๆ** — แผนบอกแต่ "function reference ตรง ๆ ไม่ต้องแก้" ไม่ครอบ: `intent-detail-client.tsx:22`, `broadcast-detail-client.tsx:122`, `friend-detail-client.tsx:21,24`, `use-conversations.ts:41` (`loadConversationsAdapter` fetch เอง), `canned-responses-client.tsx:44` (inline async) → ต้องแก้ wrapper ให้รับ/ส่งต่อ `opts` และ thread signal เข้า `fetch` ของ adapter

## 🟡 Important (should fix)

- **A11Y-01 MIRROR อ้าง pattern ผิด** — `use-session-timeout.ts` เป็น timer state (`useState`/`useEffect`) ไม่มี `useSyncExternalStore`/`matchMedia` — ตัวอย่างจริงอยู่ที่ `liff-state-redirect.tsx:102` และ `reveal.tsx:29` (verify แล้ว)
- **T0 `resetRateLimits()` เปล่า ๆ เป็น no-op** — `e2e/helpers/reset-rate-limits.ts:16` คืนทันทีเมื่อไม่มี key; pattern จริง `e2e/admin-auth.spec.ts:24` ส่ง `rateLimitKey('adminLoginIp'/'adminLoginEmail')` — ไม่เช่นนั้น criterion "รัน 2 รอบ" flake
- **NET-04 `master-data-client.tsx:475-487` คนละ pattern** — ที่นั่นเป็น `<form action={toggleActive}>` server action ใช้ `useState` pending แบบ `files-client` ไม่ได้ → ใช้ `useFormStatus`/`useTransition`
- **in-flight guard ของ `mutate()` vs per-file guards อ่านได้ 2 ทาง** — ต้องนิยามขอบเขต: mutate() กันเรียกซ้อนใน hook, per-file disable ปุ่ม
- **B: `getIntent`/`getBroadcast`/`getFriend` ไม่อยู่ใน inventory ทั้งที่ถูกเรียกใน wrapper** — แก้พร้อม critical ข้างบน

## 🟢 Minor / Suggestions

- T0 byte-compare ยกเว้นราย element ไม่ได้ → ระบุ "หน้าที่ capture แต่ยกเว้นออกจาก gate" + pin env (browser/font/GPU ต่างเครื่อง PNG ต่างกัน)
- Test NET-03 ต้อง assert ว่า signal ถึง `fetch` จริง ไม่ใช่ spy แค่ `abort()` — ไม่งั้นเคสหลุดสายผ่าน test เสมอ
- `superRefine` ระดับ object สำหรับ `scheduledAt` (`nullable.optional` — `.refine` บน field ตรง ๆ จะโดน null)
- `id="session-timeout-desc"` ต้องเพิ่มที่ `<p>` ด้วย ไม่เช่นนั้น `aria-describedby` ชี้ว่าง
- FORM-02 เลือก position ของ `actionError` ให้เหลือที่เดียว (แถวที่พัง)
- T4 ข้อความขัดกันเองเรื่อง `users-client.tsx` — ให้ตรงว่า "T1 ทำแล้ว, T4 verify"
- A11Y-04 เพิ่ม `id` ของ description element

## Reviewer Disagreements

- A6: A PASS / B FAIL — B เจาะ MIRROR pattern ที่ A ไม่ได้เช็ค
- B2/B3: A PASS / B FAIL — B เจาะ internal consistency ของ method inventory
- A2: ทั้งคู่ FAIL — root เดียวกัน (inventory)

## Confidence

```
raw = 10 − 2×1 (A2) − 1×3 (A6, B2, B3) − 1×4 (important เพิ่ม: MIRROR, resetRateLimits, master-data pattern, mutate scope) = −1 → 1
consensus FAIL → cap 7 → score = 1
```

**เหตุผลที่ score ตกจาก 4 → 1:** การแก้รอบ 4 (เติม method inventory แบบเดา) สร้าง critical ใหม่ที่ไม่มีอยู่ในรอบ 4 — บทเรียน: **inventory ที่อ้าง exhaustiveness ต้องมาจาก grep จริง**

## Recommended Next Step

**revise and re-validate** — rev.5 ใช้ inventory จริงจาก `grep -n "load:"` ทั้ง 19 ไฟล์ (14 direct ref + 6 wrapper) + แก้ important 4 ข้อ แล้ว re-validate รอบ 6

> Review-only gate: ไม่ได้แก้ plan (rev.5 เกิดหลัง review จบ) และไม่ได้เปลี่ยน git state; เขียนเฉพาะรายงานนี้
