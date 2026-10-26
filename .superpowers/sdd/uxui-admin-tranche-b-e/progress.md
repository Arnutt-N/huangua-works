# SDD ledger — plan: docs/plans/uxui-admin-tranche-b-e-PRP.md

## T0 — Baseline และด่านป้องกัน

- Ruling: หน้ามีเวลาสัมพัทธ์ (`/`, `/admin/reports`, `/admin/cases/[id]` — formatAge) ยกเว้นจาก byte gate — เพราะ content เปลี่ยนตามเวลาจริง ไม่ใช่ UI regression; cost ถ้าผิด: regression บน 3 หน้านี้จับไม่ได้ ต้องตรวจด้วยตา
- Ruling: light theme ตรวจแค่มีไฟล์ครบ, gate byte-compare ใช้ dark เท่านั้น — เพราะ font-rendering noise ต่างกันระหว่างรัน (~7/18 light ต่าง, dark นิ่ง 15/18); cost ถ้าผิด: false positive ทุก tranche
- Ruling: dark `admin_reports-1440-dark.png` ต่าง 1 ไฟล์ในรอบทดสอบ (formatAge ข้ามชั่วโมงระหว่างรัน) — ยืนยันว่าต้องยกเว้น reports; ไม่งั้น gate flake
- capture 2 รอบ: t0-r1 (36 PNG), t0-r2 (36 PNG) → diff OK (exit 0)
- gate ล้มได้จริง: fixture แก้ 1 ไบต์ → `different: admin-1440-dark.png`, exit 1

## T2 — FLOW-01/03/04 (branch feat/uxui-case-flow)

## T2 — FLOW-01/03/04: complete
- commit 1 (ca7e6bc): FLOW-04 — ลบ redirect 8 จุด, success banner รายฟอร์ม, router.refresh
- commit 2 (c16ea54): FLOW-01 UI gate (canUseSupervisorAction + 3 flags + read-only), FLOW-03 (safeInternalPath + ?return=)
- tests: navigation 6/6, require-staff 4/4; tsc ผ่าน

## T3 — A11Y-01..04: complete
- A11Y-01: use-media-query.ts (ใหม่), admin-layout inert/focus/focus-trap/aria-controls — test 1/1
- A11Y-02: files-client focus-within + pointer-coarse — test 1/1
- A11Y-03: dialog base max-h + ลบ override 3 จุด
- A11Y-04: session-timeout ไทย + aria-describedby + focus trap/return — test 2/2
- tsc + eslint ผ่าน

## T4 — NET-02/03/04: complete (pending commit)
- Layer: ApiFail.code, request 401/403 mapping + 15s timeout + NETWORK/TIMEOUT, 17 methods opts, 6 wrappers
- use-resource: load(query, opts), error/errorCode persistent, notify แยก success/error, mutate in-flight guard, abort cleanup
- AdminErrorState (card/inline) + error.tsx ('use client')
- UI 19 ไฟล์: 7 หนัก + details (error≠notFound) + composite + health/settings/conversations
- NET-04: rich-menus publish guard, intent-detail mutating guard; try/catch มีอยู่แล้ว (verify)
- tests: use-resource 17→21 (error persistence, retry clear, abort, signal-through), admin-api, error.tsx 1/1
- Ruling: notify('error') ตั้ง error แต่ไม่แตะ errorCode (applyLoadResult ตั้งก่อนเรียก notify) — cost ถ้าผิด: code หาย

## T4 — NET-02/03/04: complete
- Layer: ApiFail.code, 17 methods opts, request timeout 15s + Safari fallback, caller-abort ไม่ตั้ง error, use-resource error/errorCode persistent + notify แยก success/error, mutate in-flight guard, AbortController cleanup, wrappers 6 จุด
- UI: AdminErrorState (card/inline) 19 ไฟล์ + edit/broadcast-detail แยก 404, error.tsx boundary
- NET-04: try/catch queue/master-data/responsible, error.tsx test
- tests: use-resource 17/17, admin-api, error.tsx; tsc ผ่าน; eslint 1 warning (exhaustive-deps notify — dep จริง)
- Ruling: builder read-only ไม่ render AdminErrorState (ไม่มี empty state); cost ถ้าผิด: dropdown ว่างเงียบเมื่อ load ล้ม — ยอมรับได้เพราะ builder เป็นหน้า create ไม่ใช่ list
