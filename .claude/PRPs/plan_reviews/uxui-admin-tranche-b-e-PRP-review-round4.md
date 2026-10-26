# Plan Review (round 4): uxui-admin-tranche-b-e-PRP rev.3

**Skill**: `prp-validate-plan` v2.0.0 (2026-10-25)
**Plan**: `docs/plans/uxui-admin-tranche-b-e-PRP.md` (rev.3)
**Reviewed**: 2026-10-25
**Source PRD**: `docs/plans/uxui-admin-tranche-b-e-PRD.md`
**Findings Input**: none (B7 SKIPPED)
**Review Mode**: dual (context isolation)
**Verdict**: NOT READY
**Confidence Score**: 4/10 — single-pass implementation

> หมายเหตุ diversity: Reviewer B ถูก dispatch ด้วยโมเดล override แล้วล้มด้วย 429 rate limit — re-dispatch ด้วยโมเดล default จึงได้ **context isolation only** (ไม่มี model diversity)

## Reviewer Verdicts

| Reviewer | Diversity | Verdict | Critical issues | Important issues |
|---|---|---|---|---|
| A | context isolation | FAIL | 1 | 2 |
| B | context isolation only | PASS | 0 | 0 |

## Rubric Results (round 4)

| # | Criterion | A | B | Aggregate | Evidence |
|---|---|---|---|---|---|
| A1 | Context Completeness | PASS | PASS | PASS | ทั้งคู่ spot-check file:line 20+ จุด ตรงกับโค้ดจริง |
| A2 | Implementation Readiness | FAIL | PASS | FAIL | A: สัญญา signal สองฝั่งขัดกัน + prefix path ของ 19 ไฟล์ผิด |
| A3 | Pattern Faithfulness | PASS | PASS | PASS | `dialog.tsx:46`, `files-client.tsx:93`, `send/route.ts:30`, `require-staff.ts:19`, `admin-api.ts:14`, `use-resource.ts:26` ตรงทั้งคู่ |
| A4 | Validation Coverage | PASS | PASS | PASS | `typecheck`/`lint`/`test`/`check-contrast`/`build`/`verify-env` มีใน `package.json` จริง |
| A5 | UX Clarity | PASS | PASS | PASS | before = §2 symptoms + §2 evidence; after = สัญญา test ทุกข้อ |
| A6 | No Prior Knowledge Test | FAIL | PASS | FAIL | A: 19 ไฟล์ prefix ผิด (`use-conversations.ts`, `health-client.tsx`, `chatbot/*`) บังคับ glob หาเอง |
| B1 | Spec Coverage | PASS | PASS | PASS | PRD 13 รหัส + T0 แมปครบ; §11 เลื่อน FLOW-02/NET-01/FORM-04/05/06/A11Y-05 |
| B2 | Internal Consistency | FAIL | PASS | FAIL | A: `load(query, signal)` positional vs `opts?: { signal? }` object — `load: adminApi.listX` typecheck ไม่ผ่าน ขัดคำว่า "ไม่ต้องแก้" |
| B3 | Technical Soundness | PASS | PASS | PASS | Safari `AbortSignal` fallback, React 19 `inert`, Tailwind `pointer-coarse` (4.3.1 ติดตั้งอยู่) ถูกต้อง |
| B4 | Scope Discipline | PASS | PASS | PASS | ห้ามแตะ/ไม่ทำ ครบถ้วน |
| B5 | Risk Coverage | PASS | PASS | PASS | 8 ความเสี่ยง + mitigation; B ยืนยัน grep e2e ไม่มี `?ok=` assert |
| B6 | Testability | PASS | PASS | PASS | input→expected ครบ (safeInternalPath 6 เคส, admin-api 401/403/timeout, FLOW-01 role×tier) |
| B7 | Finding Coverage | SKIPPED | SKIPPED | SKIPPED | — |

## 🔴 Critical (must fix before implementing)

- **สัญญา signal ของ `load` callback ขัดกันระหว่างชั้น** — PRP §7 กำหนด `use-resource` ให้ `load: (query: string, signal?: AbortSignal)` แล้ว "ส่ง `controller.signal` เป็นอาร์กิวเมนต์ที่สอง" แต่ `adminApi` ให้ method รับ `opts?: { signal?: AbortSignal }` (object) — ทำให้ `load: adminApi.listX` ที่แผนระบุว่า "ไม่ต้องแก้" typecheck ไม่ผ่าน (weak-type violation: `AbortSignal` ไม่มี property `signal`) และต่อให้ compile ผ่าน `opts.signal` จะเป็น `undefined` → abort ไม่ทำงานเลย
  - หลักฐานโค้ดจริง (verify แล้ว): `src/app/admin/_lib/use-resource.ts:26` `load: (query: string) => Promise<ApiResult<TData>>;`, `src/app/admin/_lib/admin-api.ts` `listFaq: (query = '')` ไม่มี opts, `request(path, init)` ไม่รับ signal
  - ฟันธงแบบเดียวให้ชัด: เลือก object form ทั้งสองฝั่ง — `load: (query: string, opts?: { signal?: AbortSignal }) => Promise<ApiResult<TData>>` และ call `load(query, { signal: controller.signal })`

## 🟡 Important (should fix)

- **รายการ useResource 19 ไฟล์ใช้ prefix ผิด** — PRP §7 เขียน `(prefix src/app/admin/)` แต่ไฟล์จริงกระจาย: `src/app/admin/chat/_hooks/use-conversations.ts`, `src/app/admin/files/files-client.tsx`, `src/app/admin/health/health-client.tsx`, `src/app/admin/settings/settings-client.tsx` และ 15 ตัวใต้ `src/app/admin/chatbot/*` (รายชื่อปัจจุบันเพียง `auto-replies/auto-replies-client.tsx` ฯลฯ จะ resolve ผิดโฟลเดอร์) — ต้องเขียน path เต็มทั้ง 19 ตัว (ไม่ใช่ prefix + 4 ตัวท้าย) หลักฐาน: `grep -rln "useResource(" src` = 21 ไฟล์ (19 production + 2 test)
- **อ้าง `users.integration.test.ts:132,145` โดยไม่ให้ path เต็ม** — ไฟล์จริง `src/app/admin/actions/users.integration.test.ts` (verify แล้ว)

## 🟢 Minor / Suggestions

- T0 `scripts/diff-baseline.ts` ควรระบุกลไกเทียบเป็น byte-compare (fs Buffer) — `ห้ามเพิ่ม dependency` ตัด pixelmatch/pngjs ออก และ Playwright standalone ไม่มี pixel-diff API; เกณฑ์ "รัน 2 รอบภาพนิ่ง" ต้องยอมรับเงื่อนไข byte-stability
- FORM-02: บันทึกว่า success path ของ `toggleUserActive` ไม่ return ค่า — `redirect()` โยน `NEXT_REDIRECT` — event handler ห้าม try/catch กลืน; dialog ปิดด้วย navigation ไป `?ok=toggled`
- NET-03: enumerate รายชื่อ `adminApi` methods ที่ต้องรับ `opts` (เช่น `listFaq`, `listIntents`, `listBroadcasts`, `listReplyObjects`, `listRichMenus`, `listMenuAliases`, `getRichMenu`, …) กัน implementer ต้องเดาจาก 19 ไฟล์
- NET-04: สถานะ pending guard ของ `users-client.tsx`/`reply-objects-client.tsx` หลัง rebase T1 — T4 ต้อง "verify ไม่ทำซ้ำ" ให้ชัด
- FLOW-01: `canUseSupervisorAction` ถูก await สูงสุด 4 ครั้งต่อ render ของ case detail — compute ครั้งเดียวแล้ว reuse (หรือยืนยันว่า `getTierRoles` cache แล้ว)
- เติม file:line ของ MIRROR hook: `src/hooks/use-session-timeout.ts` (verify แล้วว่ามีจริง)
- `pointer-coarse:` ต้องใช้ Tailwind ≥ 4.1 — ปัจจุบัน 4.3.1 ผ่าน แต่ควรบันทึกไว้
- ระบุ label ไทยจริงของปุ่ม 3 ปุ่ม FORM-01 (ตอนนี้เขียนแค่ "label ไทยชัดเจน")

## Reviewer Disagreements

- **A2, A6, B2:** A FAIL / B PASS — B เห็นว่า signal plumbing derivable และ refs ตรง; A เจาะ type mismatch ของ load callback สองฝั่งซึ่งเป็นของจริง (verify กับ `use-resource.ts:26` + `admin-api.ts` แล้ว) → aggregate FAIL
- เสา A1/A3/A4/A5/B1/B3/B4/B5/B6 ผ่านทั้งคู่

## Confidence

```
raw = 10 − 2×2 (A2, A6) − 1×1 (B2) − 1×1 (important เพิ่ม: path users.integration.test.ts) = 4
consensus FAIL → cap 7 → score = 4
```

**แนวโน้ม:** คุณภาพแผนสูงขึ้นต่อเนื่อง (round3 = 1/10, 7 เสา fail → round4 = 4/10, 3 เสา fail) — ที่เหลือเป็นสัญญา type จุดเดียว + ความแม่นยำของ path list ไม่ใช่ architectural gap

## Recommended Next Step

**revise and re-validate** — แก้ critical 1 + important 2 ในเอกสารเดิม (แก้ §7 สัญญา `load` เป็น object form ทั้งสองฝั่ง, แทนรายชื่อ 19 ไฟล์ด้วย path เต็ม, เติม path ของ `users.integration.test.ts`) แล้ว re-validate รอบ 5

> Review-only gate: ไม่ได้แก้ plan และไม่ได้เปลี่ยน git state; เขียนเฉพาะรายงานนี้
