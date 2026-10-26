# PRP-Plan — UX/UI แอดมิน Tranche B–E (rev.12)

วันที่: 26 ตุลาคม 2026
คู่กับ: `docs/plans/uxui-admin-tranche-b-e-PRD.md`
ทุก tranche = branch + PR ของตัวเองตาม `AGENTS.md` ห้ามรวมเป็น PR เดียว

> rev.1 — แก้ findings จาก `/prp-validate-plan` รอบแรก (critical 2 + important 10): ตัดสิน module ของ permission helper, แก้ file:line fail-closed, ระงับขัดแย้ง FLOW-03 vs FLOW-04, ระบุ `ApiFail`/`code` type, รายชื่อ caller ครบ, สร้าง test file ที่ไม่มีอยู่, input/expected pairs, เติม build/env gate
>
> rev.2 — แก้ findings รอบที่สอง: FORM-01 expected ทน TZ (ห้ามแก้โค้ดให้ตรง test), FLOW-04 ใช้ `CaseActionState` เดิม (`success`), FORM-02 error เก็บใน `useState`, NET-03 ระบุวิธี thread `AbortSignal` ผ่าน `load` + fallback Safari, เพิ่ม `canned-responses-client` ในรายการ UI, FLOW-03 ห้ามแตะ `liff-state-redirect.tsx`, send-now payload `scheduledAt: null`, แก้ `ApiFail` เป็น `:14`, T0 ไม่แตะ protected แม้ชั่วคราว
>
> rev.3 — แก้ findings รอบที่สาม: เพิ่ม `npx next build` ในด่าน, แคบข้อความเรื่อง `?ok=` ให้ตรง (users มีของตัวเอง ห้ามแตะ), แก้รายชื่อไฟล์ T4, เพิ่ม rule `..` ใน `safeInternalPath`, เพิ่มงาน success feedback ของ FORM-03, enumerate `useResource` callers ทั้ง 19 ไฟล์, เพิ่ม test contract ให้ NET-04, ฟันธง expected ของ FLOW-01/A11Y-02, แก้ `load` type เป็น `:26`
>
> rev.4 — แก้ findings รอบที่สี่ (critical 1 + important 2 + minors): ฟันธงสัญญา `load`/`adminApi` เป็น object form ทั้งสองฝั่ง (`opts?: { signal? }`) ให้ `load: adminApi.listX` typecheck ผ่านจริง, แทนรายชื่อ 19 ไฟล์ด้วย path เต็มทุกตัว, เติม path เต็มของ `users.integration.test.ts`, บันทึก `NEXT_REDIRECT` ของ FORM-02, ชี้แจง T4 verify ไม่ทำซ้ำ pending guard ของ T1, compute `canUseSupervisorAction` ครั้งเดียว, ระบุ byte-compare ของ T0 diff, label ไทย 3 ปุ่ม FORM-01, MIRROR hook file:line, Tailwind `pointer-coarse` ≥4.1
>
> rev.5 — แก้ findings รอบที่ห้า (critical 1 + important 4 + minors): **แทนรายชื่อ load-callback ด้วย inventory จริงจาก grep ทั้ง 19 ไฟล์** (14 direct ref + 6 wrapper; ลบ `getRichMenu` ที่ไม่ใช่ load callback; ระบุวิธี thread signal ผ่าน wrapper/adapter ที่เรียก `fetch` เอง), `resetRateLimits()` ต้องส่ง key ตาม `e2e/admin-auth.spec.ts:24`, MIRROR `use-session-timeout.ts` เป็น location reference เท่านั้น (implementation ใหม่), `master-data-client` ต้องใช้ `useFormStatus`/`useTransition` ไม่ใช่ pending flag ของ files-client, นิยามขอบเขต in-flight guard ของ `mutate()` แยกจาก per-file guards, `id="session-timeout-desc"` บน `<p>`, เลือก position ของ actionError (ต่อแถว), T4 verify ไม่ทำซ้ำ guard ของ T1, test ต้อง assert signal ถึง fetch จริง
>
> rev.6 — แก้ findings รอบที่หก (important 2 + minors): กำหนด `errorCode?: ApiFail['code']` ใน `UseResourceResult` ให้ `AdminErrorState` มีที่มาของ `code` ชัด, แก้ A11Y-02 assertion ให้ assert ที่ wrapper div `:93` ไม่ใช่ปุ่ม, แคบ "นอกเหนือจากนี้ไม่ต้องแก้" ให้ครอบ 3 wrapper methods, แก้ line ref `use-resource.ts:106` + เพิ่ม `:143`, FORM-01 past-guard ใช้เฉพาะ `'schedule'`, เพิ่ม `actionErrorUserId`, ระบุ prop ใหม่ 3 ตัวของ FLOW-01, ระบุ signature `(query = '', opts?)` ของ zero-arg methods
>
> rev.7 — แก้ findings รอบที่เจ็ด: แทนรายการ "zero-arg 11 ตัว" ด้วยตาราง signature จริงราย method (14 methods — ไม่เปลี่ยนพารามิเตอร์แรก, GOTCHA `listFriendEvents` ถูกส่ง search query เข้า `friendId` อยู่เดิมและห้ามแก้ semantics), แก้ role matrix เป็น `officer/chief/head/superadmin` ตาม `ALL_ROLES` (ไม่มี `admin`), A11Y-01 เพิ่ม backdrop assertion, A11Y-03 เพิ่ม keyboard viewport 400px, แก้ cite past-guard `:122`, align PRD callers = 17 production + 1 story
>
> rev.8 — แก้ findings รอบที่แปด: `notify()` แยก error ออกจาก timer (error คงค้างจนกว่าจะ reload สำเร็จ; mutation error ต้อง set `error`/`errorCode` ไม่ใช่ `notify('error')` อย่างเดียว), แก้สัญญา `UseResourceResult` ว่า `error` เป็น **field ใหม่ทั้งหมด** (ปัจจุบันมีแค่ feedback ที่ auto-clear), เกณฑ์ NET-03 ครอบ 19 ไฟล์ — รวม 2 จุดที่ตี error เป็น not-found (`intent-detail-client:161`, `friend-detail-client:30`), แก้ line refs ที่ drift (`rich-menus:25`, `files:21`, `auto-replies:36`, `aliases:25-26`, `broadcast:110`, `canned-responses:43`), ระบุ `!loading` guard ใน UI row, บันทึก T0 ต้องมี app server ที่รันอยู่
>
> rev.9 — **format-only (เนื้อหาเท่า rev.8)**: ปิด findings รอบที่สิบ — เติมป้าย **ACTION / IMPLEMENT / MIRROR / VALIDATE** กำกับทุก task row ให้ rubric A2 ตรวจตรงตัว, เติมบรรทัด **import** ของ 3 โมดูลใหม่ให้ consumer, แนบ **skeleton** ของ `navigation.ts` + `admin-error-state.tsx` และ **error branch template** 1 ไฟล์ให้ copy ได้
>
> rev.10 — แก้ findings รอบที่สิบเอ็ด: เติมป้าย ACTION/IMPLEMENT/MIRROR/VALIDATE ให้ครบทุก task row (รวม `cases/[id]/page.tsx` ×2, 3 caller ที่ลบ max-h, pending guards, try/catch actions), เติม **implement detail ของ `src/app/admin/error.tsx`** (signature `({ error, reset })`, ปุ่มไทย, log digest, VALIDATE), **ฟันธง `notify('error')`** = set ทั้ง `feedback` (inline, auto-clear ตาม `FEEDBACK_MS` — คงสัญญา FORM-03) **และ** persistent `error`/`errorCode` (ไม่มี timer, clear เมื่อ request ถัดไปสำเร็จ) + `AdminErrorState` มี 2 variant (`card`/`inline`) และเกณฑ์ 19 ไฟล์ครอบทั้งสองกรณี, แก้ typo `geณฑ์`→`เกณฑ์`, แก้ template destructure เป็น `reload`
>
> rev.11 — แก้ findings รอบที่สิบสอง (B เจอ critical 2 ที่ A ไม่เคยเจอ): **T0 อ้าง seed case ที่ไม่มีอยู่จริง** (verified: `grep -c "insert(cases)" scripts/seed.ts` = 0) → capture script ต้องสร้าง case เองหรือยก route ออกจาก gate, **T0 ขาด `npx next dev`** ใน Dependencies, §1 แคบ T4 file-surface ให้ตรง §7, `error.tsx` เติม `'use client'`, AdminErrorState rollout scope = 19 ไฟล์ (7 = จุดหนัก), dark theme สลับด้วย `setAttribute` ไม่แตะ layout, timeout vs caller-abort แยกด้วย `abortRef.timedOut` + caller abort ไม่ตั้ง error, T0 acceptance นับ route ไม่ใช่ source path, FLOW-03 e2e ชี้ back link `:181-187`, `/admin/reports` ยกเว้นจาก byte gate (`formatAge`), `use-resource.ts:4` ต้อง import `ApiFail`, แก้ span `handleCreate`, ระบุหน่วย call-site
>
> rev.12 — แก้ findings รอบที่สิบสาม (A จับจริง, B PASS อยู่แล้ว): เติม MIRROR/VALIDATE ที่ขาดใน 6 rows (`reports/page`, hidden-input `return`, case-detail refresh, edit-client, broadcast-detail, pending guards, try/catch), ใส่ signature `createCase(input: CaseIntakeInput): Promise<CaseIntakeResult>` (`intake.ts:45`) ให้ T0 helper, แก้ line drift ตาม suggestions

**Convention ของแผนนี้:** ทุก task row อ่านเป็นลำดับ **ACTION → IMPLEMENT → MIRROR → VALIDATE** — ป้ายกำกับอยู่ในคอลัมน์ "การเปลี่ยนแปลง" ต่อท้ายแต่ละข้อ (`**ACTION:**` = ทำอะไรกับไฟล์ไหน, `**IMPLEMENT:**` = แก้อย่างไรให้ typecheck ผ่าน, `**MIRROR:**` = pattern/location ref ที่ต้องเลียน (หรือ "ไม่มี — เขียนใหม่"), `**VALIDATE:**` = test/เกณฑ์ที่ต้องผ่าน)

## 1. ลำดับและ dependency

```
                  ┌── T1 FORM (B) ──┐
T0 Baseline ──────┤   (ขนานกัน)     ├──────► T3 A11Y (D) ──────► T4 NET (E)
                  └── T2 FLOW (C) ──┘                                  │
                                     files-client ────────────────────┘  (A11Y-02 → NET-03)
                                     users-client / reply-objects ───────► NET-04 guards
```

T1 กับ T2 ขนานได้จริง (ไม่ชนไฟล์); T4 ต้อง rebase บน T1 — **ไฟล์ที่ทับกับ T1 มีเพียง 2 ไฟล์: `users-client.tsx`, `reply-objects-client.tsx`** (T4 ยังแก้ไฟล์ของตัวเองอีกจำนวนมากตาม §7: `admin-api.ts`, `use-resource.ts`, 2 test, `admin-error-state.tsx`, `error.tsx`, 19 rollout files, 5 action files)

- T1 กับ T2 ไม่ชนไฟล์กัน → ทำขนานได้ (branch แยก, merge เรียงตามลำดับ)
- T3 ต้องก่อน T4 เพราะ `files-client.tsx` เป็นไฟล์เดียวที่ทั้งสองแตะ (A11Y-02 + NET-03 error state)
- T4 แตะไฟล์ที่ T1 แก้ (`users-client.tsx` pending/error, `reply-objects-client.tsx` guards) → ต้อง rebase บน T1; **T4 เพียง verify ว่า guard ของ T1 ยังอยู่ ห้ามเขียนซ้ำ**; T4 **ไม่แตะ** `broadcast-wizard-client.tsx` (ปิดจบใน T1 แล้ว)

## 2. หลักฐานยืนยัน (static review 25 ต.ค. 2026)

| รหัส | สถานะ | หลักฐานหลัก |
|---|---|---|
| FORM-01 | CONFIRMED | `broadcast-wizard-client.tsx:128-133, 448-450`; `api/line/admin/broadcasts/route.ts:93`; test codify พฤติกรรมผิดที่ `broadcast-wizard-client.test.tsx:175-194` |
| FORM-02 | CONFIRMED | `users-client.tsx:171-186`; wrapper ทิ้ง error `users-client.tsx:468-470`; `actions/users.ts:108-165` |
| FORM-03 | CONFIRMED | `reply-objects-client.tsx:26` (ไม่ได้ destructure `feedback`), `:58-80`; `new-reply-object-client.tsx:34` ทิ้ง `res.error`; `_components/reply-object-form.tsx:113-121` |
| FLOW-01 | CONFIRMED | gates `actions/cases.ts:88,133,157,187` vs ฟอร์มไม่มีเงื่อนไข `case-detail-client.tsx:273-341`; prop มีแค่ `canChangeDepartment` `:60`, `page.tsx:176` |
| FLOW-03 | CONFIRMED | row link ไม่มี query `reports/page.tsx:232`; back link ตายตัว `cases/[id]/page.tsx:181-187`; redirect 8 จุด `actions/cases.ts:60,81,101,122,147,177,201,233` |
| FLOW-04 | CONFIRMED | 8 ฟอร์มอิสระ `case-detail-client.tsx:79-110`, comment `:78`; redirect ทุก success path |
| A11Y-01 | CONFIRMED | `admin-layout.tsx:98-107` transform only, ไม่มี inert; ไม่มี focus trap/return `:72-79` |
| A11Y-02 | CONFIRMED | `files-client.tsx:93` `opacity-0 group-hover:opacity-100` |
| A11Y-03 | CONFIRMED | `ui/dialog.tsx:46` ไม่มี max-h/overflow; 18 รายการ caller (รายชื่อใน §6 A11Y-03: production 17 + stories); 3 caller workaround เอง (`detail-modal.tsx:43`, `chat-client.tsx:227`, `reply-objects-client.tsx:198`) |
| A11Y-04 | CONFIRMED | `session-timeout-warning.tsx:34,39-41,46,49` strings อังกฤษ; ไม่มี focus handling; ขาด `aria-describedby` `:22-25` |
| NET-02 | CONFIRMED | `require-staff.ts:186-192` ส่ง `Forbidden`/`Unauthorized`; adapter คืน envelope ดิบ `admin-api.ts:381-386`; `use-resource.ts:22` FEEDBACK_MS=4000 |
| NET-03 | CONFIRMED | ไม่มี signal/timeout ทั้ง `admin-api.ts:372-375` และ `use-resource.ts`; empty state หลายหน้า e.g. `rich-menus-client.tsx:26,79-87`; `edit-client.tsx:69-78` ตี error เป็น not-found |
| NET-04 | PARTIALLY CONFIRMED | ไม่มี auto-retry (ดีอยู่แล้ว); double-submit guard ขาดที่ `rich-menus-client.tsx:40-42`, `aliases-client.tsx:53-62`, `reply-objects-client.tsx:58-80`, `intent-section.tsx:161-169`, `settings-client.tsx:92-94`, `users-client.tsx:171-186`; DB writes ไม่มี try/catch `actions/queue.ts:56-72`, `actions/master-data.ts:208,252-262`, `actions/responsible.ts:119-129,146-150`; ไม่มี `src/app/admin/error.tsx` |

## 3. T0 — Baseline และด่านป้องกัน (ทำก่อนแก้ UI ทุกกรณี)

**ไฟล์ใหม่**

- `scripts/capture-baseline.ts` — **ACTION:** สร้างสคริปต์ capture ใหม่ — **MIRROR:** pattern login+reset จาก `e2e/admin-auth.spec.ts:24` — **IMPLEMENT:** Playwright แบบ standalone (ไม่ใช้ test runner): เปิดหน้าและ screenshot ลง `docs/baseline/<commit>/<route>-<viewport>-<theme>.png`
  - viewport: 375×812, 1440×900; theme: light/dark — **GOTCHA:** `src/app/layout.tsx:90` hardcode `data-theme="light"` → capture script ต้องสลับเองด้วย `page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))` หลังโหลดหน้า ก่อน screenshot (ห้ามแก้ `layout.tsx` — อยู่นอกขอบเขต)
  - login admin ด้วย seed (`admin@huangua.go.th`) ตาม `e2e/admin-auth.spec.ts`; เรียก `resetRateLimits(rateLimitKey('adminLoginIp', E2E_CLIENT_IP), rateLimitKey('adminLoginEmail', ADMIN_EMAIL))` ตาม pattern ใน `e2e/admin-auth.spec.ts:24` — **ห้ามเรียก `resetRateLimits()` เปล่า ๆ** เพราะ function เป็น variadic และคืนค่าทันทีเมื่อไม่มี key (`e2e/helpers/reset-rate-limits.ts:16`) → login counter ไม่ถูกล้างและ criterion "รัน 2 รอบ" จะ flake โดน rate limit
  - **route ที่ต้องเก็บครบทุกครั้ง:** `/` (landing), `/admin` (dashboard), `/admin/reports`, `/admin/cases/[id]` — **GOTCHA: `scripts/seed.ts` ไม่ได้สร้าง case เลย** (`grep -c "insert(cases)" scripts/seed.ts` = 0; seed มีแค่ departments `:78`, categories `:220`, users `:255`) ดังนั้น capture script ต้อง**สร้าง case 1 เรื่องเองผ่าน helper** — **MIRROR:** integration test ที่เรียก `createCase` — **IMPLEMENT:** `createCase(input: CaseIntakeInput): Promise<CaseIntakeResult>` (`src/lib/cases/intake.ts:45`; `CaseIntakeInput` ต้องการ `title`/`description`/`categoryId` เป็นขั้นต่ำ — ดู `:8-39`) แล้ว pin `trackingCode` จากผลลัพธ์ลง `docs/baseline/README.md` — **VALIDATE:** เกณฑ์ผ่าน T0 ข้อ 1-2 | แล้ว pin tracking code ลง `docs/baseline/README.md`; ถ้าไม่ทำ ให้ยก route นี้ออกจาก T0 gate และระบุใน README ว่า "ยกเว้น", `/admin/users`, `/admin/chatbot/broadcast/new`, `/admin/chatbot/reply-objects`, `/admin/files`, `/admin/settings`
  - **VALIDATE:** เกณฑ์ผ่าน T0 ข้อ 1-2 (`:72-73`)
- `docs/baseline/README.md` — **ACTION:** เขียน README วิธีรัน — **MIRROR:** ไม่มี — **IMPLEMENT:** วิธีรัน, commit ที่เก็บ, ข้อจำกัด: หน้าแรกมีสถิติจริง/ปีงบประมาณ → ต้อง seed ข้อมูลคงที่ก่อนรัน (`npx tsx scripts/seed.ts` + `scripts/seed-villages.ts`, `scripts/seed-geodata.ts`) — **byte-compare ไม่มีกลไกยกเว้นราย element** (pixelmatch ถูกตัดเพราะ `ห้ามเพิ่ม dependency`) ดังนั้นให้ระบุเป็น **"หน้าที่ capture แต่ยกเว้นออกจาก gate"** — **`/admin/reports` ต้องถูกยกเว้นเสมอ** เพราะมี `formatAge(Date.now())` (`reports/page.tsx:35-40`) เปลี่ยนทุกชั่วโมง; `/` และ `/admin` ยกเว้นถ้าสถิติ/ปีขยับ หรือ crop เฉพาะ region ที่นิ่ง — ระบุใน README ด้วยว่าเทียบบน environment เดียวกันเท่านั้น (browser/font/GPU ต่างเครื่องทำให้ PNG ต่างกัน; pin Playwright browser version ใน README และยอมรับ fallback "ยืนยันไม่ได้" อย่างเป็นทางการ) — **VALIDATE:** เกณฑ์ผ่าน T0 ข้อ 2 (`:73`)
- `scripts/diff-baseline.ts` — **ACTION:** สร้างสคริปต์เทียบภาพ — **MIRROR:** ไม่มี — **IMPLEMENT:** เทียบภาพก่อน/หลังด้วย **byte compare (fs Buffer เท่ากันทุกไบต์)** — `ห้ามเพิ่ม dependency` ตัด pixelmatch/pngjs ออก และ Playwright standalone ไม่มี pixel-diff API; คืน exit code 1 เมื่อภาพไม่ตรง (ให้ CI-local/commit hook เรียกได้); ทดสอบว่า gate ล้มจริงโดยใช้ **ไฟล์ fixture ที่ไม่ใช่ protected** (คัดลอกภาพแล้วแก้) — ห้ามแก้ไฟล์ protected แม้ชั่วคราวเพื่อทดสอบ; การยืนยันว่าจับหน้าแรกได้ให้ script assert **รายการ route ที่ต้อง capture ครบ 9 รายการ** (รายชื่อเดียวกับ "route ที่ต้องเก็บครบทุกครั้ง" ด้านบน) — ไม่ใช่ path ของไฟล์ source — **VALIDATE:** เกณฑ์ผ่าน T0 ข้อ 3 (`:74`)

**ห้าม** แก้ production code เพื่อให้ screenshot นิ่ง — ใช้ seed/DB state ใน env ทดสอบเท่านั้น

**เกณฑ์ผ่าน T0**

1. รันสคริปต์ 2 รอบติดกัน ภาพนิ่ง (ยกเว้น element ที่ขึ้นกับเวลา — ระบุใน README)
2. ภาพหน้าแรกก่อนเริ่มงานทุก tranche ถูก commit ไว้
3. `scripts/diff-baseline.ts` ทำให้ gate ล้มได้จริง — ทดสอบด้วย **fixture ภาพที่ไม่ใช่ไฟล์ protected** (คัดลอกแล้วแก้); ห้ามแก้ไฟล์ protected แม้ชั่วคราว

**Dependencies:** Docker stack + seed (`docker compose up -d postgres redis up-redis`, `npx drizzle-kit push`, `npx tsx scripts/seed.ts`) + **Next server รันอยู่ที่ `http://localhost:3000` (`npx next dev`)** — `scripts/capture-baseline.ts` เป็น standalone Playwright ที่ต้องต่อ server จริง ไม่ใช่ test runner ที่ start server เอง; baseURL อ่านจาก env `E2E_BASE_URL ?? http://localhost:3000`

---

## 4. T1 — FORM-01/02/03 (branch `feat/uxui-form-feedback`)

### FORM-01 — แยกความหมาย ร่าง / ตั้งเวลา / ส่งเลย

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `src/app/admin/chatbot/broadcast/new/broadcast-wizard-client.tsx` | **ACTION:** เปลี่ยน `handleCreate()` (`:111` ฟังก์ชันเริ่ม, `:128-133` payload, `:448-450` ปุ่ม) เป็น `handleCreate(mode: 'draft' \| 'schedule' \| 'send-now')` — **MIRROR:** ไม่มี (UI ใหม่) — **IMPLEMENT:** `'draft'` → ส่ง `scheduledAt: null` เสมอ; `'schedule'` → ส่งค่าจริงจาก `scheduleAt` ต้อง validate เป็นเวลาอนาคต (ห้ามส่งถ้าว่าง — **past-time guard เดิม `:122-126` (เจ้าจริงอยู่ที่ `:122` `if (scheduleAt && new Date(scheduleAt).getTime() <= Date.now())`) ใช้เฉพาะ mode นี้**); `'send-now'` → POST แล้วเรียก `/send` ต่อ (แสดง confirm ว่า "ส่งทันที" ซึ่งจะยกเลิกเวลาที่ตั้งไว้ — **ข้าม past-time guard** เพราะ payload ส่ง `scheduledAt: null` อยู่แล้ว) — ปุ่ม 3 ปุ่ม label ไทยชัดเจน: **"บันทึกแบบร่าง"**, **"ตั้งเวลาและบันทึก"**, **"ส่งเลย"** — **VALIDATE:** สัญญา test `:90-96` |
| `src/app/api/line/admin/broadcasts/route.ts` | **ACTION:** เพิ่ม validation ใน `createSchema` (`:17-22`) — **MIRROR:** ไม่มี (inline เท่านั้น) — **IMPLEMENT:** เพิ่ม Zod refine ที่ `scheduledAt` ต้องเป็นเวลาอนาคต (ปฏิเสธอดีต/ปัจจุบันด้วย 400 ข้อความไทย) — ใช้ **`superRefine` ระดับ object** (field `scheduledAt` เป็น `nullable.optional` → ถ้าใช้ `.refine` บน field ตรง ๆ จะโดน `null`/`undefined` ด้วย หรือ type ไม่ให้) — แก้ **inline ใน route นี้** ไม่ย้ายไป `src/lib/validation.ts` — **VALIDATE:** contract test POST broadcasts (`route.contract.test.ts`) |
| `src/app/admin/chatbot/broadcast/new/broadcast-wizard-client.test.tsx` | **ACTION:** แก้ test ผิด — **IMPLEMENT:** แก้ test ที่ codify พฤติกรรมผิด (`:175-194`): draft → `scheduledAt === null`; schedule → assert แบบทน TZ (getTime หรือ regex offset แบบ test เดิม `:193`); send-now → payload `scheduledAt === null` และ `/send` ถูกเรียก |

**สัญญา test (input → expected) — ทน timezone:**
- `mode='draft'` + มี `scheduleAt` ตั้งไว้ → payload `scheduledAt === null`, ไม่เรียก `/send`
- `mode='schedule'` + `scheduleAt='2030-01-01T10:00'` → `scheduledAt` ไม่ null และ `new Date(payload.scheduledAt).getTime() === new Date('2030-01-01T10:00').getTime()` (หรือใช้ regex ทน offset แบบ test เดิม `broadcast-wizard-client.test.tsx:193`)
  — **ห้าม assert ISO string ตรงตัว**: `datetime-local` เป็น local time; บน Asia/Bangkok จะได้ `03:00Z` ไม่ใช่ `10:00Z`; vitest ไม่ pin TZ
  — **ห้ามแก้โค้ดฝั่ง client ให้ตรง expected** ที่ผิด — ถ้า test แดงให้แก้ test ไม่ใช่ production
- `mode='schedule'` + `scheduleAt` ว่าง → แสดง validation error ในฟอร์ม, ไม่ส่ง request
- `mode='send-now'` + `scheduleAt` ตั้งไว้ → payload `scheduledAt: null` (ทิ้งเวลาตามที่ confirm บอก) แล้วเรียก `/send` ทันที; `/send` route บังคับ `scheduledAt = new Date()` เอง (`api/line/admin/broadcasts/[id]/send/route.ts:30`)

### FORM-02 — ยืนยัน + pending + แสดง error ของการระงับบัญชี

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `src/app/admin/users/users-client.tsx` | **ACTION:** แทน `<form action={toggleUserAction}>` (`:171-186`) ด้วยปุ่มที่เปิด `ConfirmDialog` — **MIRROR:** `ConfirmDialog` API (`:33-48` `busy`/`onConfirm`) — **IMPLEMENT:** `description` ระบุผลกระทบจริง ("ผู้ใช้จะเข้าสู่ระบบไม่ได้จนกว่าจะเปิดใช้งานใหม่"); `onConfirm: () => void` ต้อง build `FormData` ข้างใน handler (ตั้ง `userId`, ลบ `isSelf` ที่เป็น dead field `:173`) แล้วเรียก `toggleUserActive({ error: null }, formData)` ตรง ๆ จาก event handler — **ไม่ใช้ `useActionState`/`form action`** เพราะไม่ได้ submit ผ่าน form อีกต่อไป; เก็บ pending และ error ใน `useState` คู่กัน — `const [pendingId, setPendingId] = useState<string \| null>(null)` และ `const [actionError, setActionError] = useState<{ userId: string; message: string } \| null>(null)` (ไม่มี `useActionState` แล้ว จึงไม่มี `state.error` ให้อ่าน — ต้องมี `userId` เพื่อวาง error ที่แถวที่พังได้จริง) ส่ง `pending={pendingId === user.id}` ให้ `ConfirmDialog` `busy` prop และ disable ปุ่มต้นทาง; แสดง `actionError` ใน `FormError` ที่มีอยู่ (`:472-482`) **ที่เดียว: เหนือปุ่ม toggle ของแถวที่พัง** (ไม่ใช่ใต้ตาราง — เลือก position เดียวเพื่อกัน error ไปโผล่คนละที่กับแถวที่ทำให้เกิด); ลบ wrapper ที่ทิ้ง error (`:468-470`) — **VALIDATE:** สัญญา test `:105-109` |
| `src/app/admin/users/users-client.test.tsx` | **ACTION:** สร้างไฟล์ test ใหม่ — **IMPLEMENT:** **สร้างใหม่** (ตอนนี้ไม่มีไฟล์ test ใต้ `src/app/admin/users/`) — ครอบ: เปิด dialog → ยืนยัน → เรียก action; ยกเลิก → ไม่เรียก; error จาก action แสดงใน UI; ระหว่าง pending ปุ่มถูก disable |

**สัญญา test (input → expected):**
- กด "ระงับบัญชี" → เปิด `ConfirmDialog` ยืนยัน, ยังไม่ส่ง action จนกว่าจะกด "ยืนยัน"
- กด "ยกเลิก" → `toggleUserActive` ไม่ถูกเรียก
- `toggleUserActive` คืน `{ error: 'ข้อความ' }` → แสดงใน `FormError`, dialog ปิด, ปุ่มกลับมากดได้
- ระหว่าง `pending=true` → ปุ่มยืนยันใน dialog `disabled`, label เปลี่ยนเป็น "กำลังดำเนินการ..."

**หมายเหตุ:** สำเร็จแล้ว `toggleUserActive` ยัง `redirect('/admin/users?ok=toggled')` เหมือนเดิม (`actions/users.ts:164`) — อยู่นอกขอบเขต FLOW-04 ที่แก้เฉพาะ `actions/cases.ts` — **GOTCHA:** `redirect()` โยน `NEXT_REDIRECT` ซึ่งเป็น success flow ไม่ใช่ error — handler ของ ConfirmDialog ห้ามห่อด้วย try/catch ที่กลืนข้อยกเว้นนี้; dialog ปิดด้วย page navigation ไป `?ok=toggled` ของเดิม

### FORM-03 — Feedback ครบใน reply-objects

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `src/app/admin/chatbot/reply-objects/reply-objects-client.tsx` | **ACTION:** destructure `feedback` (`:26`) + เพิ่ม pending/success + เปลี่ยน confirm — **MIRROR:** banner pattern `broadcast-client.tsx:192-196` — **IMPLEMENT:** render banner ตาม pattern; **เพิ่ม success feedback**: ทุก mutation ที่สำเร็จ (create/update/toggle/delete) ต้อง `notify('success', …)` หรือแสดง banner — ปัจจุบันสำเร็จแล้วแค่ reload เงียบ (`:58-80`); เพิ่ม pending flag ให้ toggle/delete (`:58-80`) และ disable ปุ่ม (`:171,185`); เปลี่ยน native `confirm()` (`:73`) เป็น `ConfirmDialog` (import ตาม `@/components/admin/confirm-dialog` ข้างบน) — **VALIDATE:** สัญญา test `:122-126` |
| `src/app/admin/chatbot/reply-objects/new/new-reply-object-client.tsx` | **ACTION:** แสดง error — **IMPLEMENT:** แสดง `res.error` (`:34`) แทน return `false` เงียบ |
| `src/app/admin/chatbot/reply-objects/_components/reply-object-form.tsx` | **ACTION:** รับ error + ส่งผ่าน — **IMPLEMENT:** รับ error จาก parent และแสดง; label ปุ่มเป็น "กำลังบันทึก…" ระหว่าง `saving` (`:245`); ห้ามกลืน exception (`:119-121`) |
| `src/app/admin/chatbot/reply-objects/reply-objects-client.test.tsx` | **ACTION:** เพิ่ม test case — **IMPLEMENT:** เพิ่มกรณี: error มองเห็น, pending disable, delete ผ่าน confirm |

**สัญญา test (input → expected):**
- `handleToggleActive` คืน error → banner แสดงข้อความเดิมจาก `feedback` — **FIFO หลัง T4:** ถ้าทำ T4 แล้ว ให้ mutation error ตั้งผ่าน `notify('error')` ที่กลายเป็น persistent `error` — หน้า `data !== null` ต้อง render `AdminErrorState` ในแบบ inline banner บน `error` ไม่ใช่ `AdminErrorState` เฉพาะ `data === null` — **ฟันธง:** `AdminErrorState` มี variant `inline` (banner เล็ก) สำหรับ `data !== null && error`, เต็ม card สำหรับ `data === null && error`
- กำลัง load mutation → ปุ่ม toggle/delete `disabled`
- `handleDelete` → เปิด `ConfirmDialog` ก่อนเรียกจริง (ไม่ใช้ `window.confirm`)
- ทุก mutation สำเร็จ (create/update/toggle/delete) → มี success banner/notification แสดงอย่างน้อย 1 ครั้ง ไม่ใช่แค่ reload เงียบ

**Test strategy T1:** vitest unit ต่อไฟล์ (mock `adminApi`), 1 contract test ของ POST broadcasts ที่ตรวจ payload/status จริงผ่าน route handler (ไม่แตะ LINE จริง) — ไฟล์ใหม่ `src/app/api/line/admin/broadcasts/route.contract.test.ts` (invoke `POST` export ตรง ๆ + mock `requireStaffApi`/`getDb` ผ่าน `vi.mock`)

**Dependencies:** ไม่มี; ขนานกับ T2 ได้

---

## 5. T2 — FLOW-01/03/04 (branch `feat/uxui-case-flow`)

> **ระงับขัดแย้ง FLOW-03 vs FLOW-04 (critical #1):** FLOW-04 **ลบ** redirect ทั้ง 8 จุดใน `actions/cases.ts` → หลังจากนั้นไม่มี redirect ให้ต่อ `&return=` แล้ว ดังนั้น **FLOW-03 ไม่แตะ `actions/cases.ts` เลย** — `?return=` ถูกส่งผ่าน URL/`searchParams` ของหน้าเท่านั้น (ไม่ใช่ผ่าน redirect ของ server action) ทำ T2 เป็น 2 commit เรียง: (1) FLOW-04 ลบ redirect → in-place success + `router.refresh()`; (2) FLOW-03 เติม `return` param ฝั่ง navigation ปกติ

### FLOW-01 — UI gate ตาม tier matrix เดียวกับ server

**ตัดสิน module แล้ว (แก้ A2/A6):** ขยาย `src/lib/auth/require-staff.ts` ที่เป็น choke point เดิม — **export** `resolveAllowedRoles` (เปลี่ยน `async function` `:19` เป็น `export async function`) และเพิ่ม helper ใหม่ในไฟล์เดียวกัน ไม่สร้าง `permissions.ts` แยก (เลี่ยงคัดลอก logic ซ้ำซึ่งแผนห้ามเอง)

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `src/lib/auth/require-staff.ts` | **ACTION:** export helper ที่มีอยู่ + เพิ่ม helper ใหม่ในไฟล์เดียวกัน (ไม่สร้าง `permissions.ts`) — **MIRROR:** ไม่มี (choke point เดิม) — **IMPLEMENT:** `export async function resolveAllowedRoles(...)` (`:19`); เพิ่ม `export async function canUseSupervisorAction(role: UserRole): Promise<boolean>` ที่เรียก `resolveAllowedRoles(CASE_SUPERVISOR_ROLES)` แล้วเช็ค `includes(role)` — **async เสมอ** (อ่าน DB) และ fail-closed ตามเดิม (`:28-33` catch → `SUPERADMIN_ONLY`) — **VALIDATE:** สัญญา test `:148-152` |
| `src/app/admin/cases/[id]/page.tsx` | **ACTION:** เปลี่ยน static gate เป็น async — **MIRROR:** `canUseSupervisorAction` ใหม่ใน `require-staff.ts` — **IMPLEMENT:** เปลี่ยน `canChangeDepartment` (`:176`) จาก static `CASE_SUPERVISOR_ROLES.includes` เป็น **compute ครั้งเดียวแล้ว reuse**: `const canSupervise = await canUseSupervisorAction(staffUser.role)` แล้วใช้ค่านี้กับ flags ทั้ง 4 (`canChangeDepartment`, `canChangeBudget`, `canChangeBudgetAmount`, `canChangeActionDetails`) — ห้าม await helper ซ้ำ 4 ครั้งต่อ render (แต่ละครั้งอ่าน DB); ส่งเป็น props |
| `src/app/admin/cases/[id]/case-detail-client.tsx` | **ACTION:** ห่อ 3 ฟอร์มด้วย flag + เพิ่ม prop — **MIRROR:** pattern `canChangeDepartment` เดิม (`:60`) — **IMPLEMENT:** **prop ใหม่ 3 ตัว** (`canChangeBudget`, `canChangeBudgetAmount`, `canChangeActionDetails` — ปัจจุบันมีแค่ `canChangeDepartment` `:60`) ต้องประกาศใน `CaseDetailClientProps` และห่อ 3 ฟอร์มด้วย flag (`:273-341`); บทบาทที่ไม่มีสิทธิ์เห็นค่าปัจจุบันแบบอ่านอย่างเดียว (ไม่ซ่อนข้อมูล) — **VALIDATE:** เกณฑ์ผ่าน `role × action` ตรง `actions/cases.ts:88,133,157,187` |

**สัญญา test (input → expected):**
- role=`officer` + tier default → `canUseSupervisorAction === false` → ฟอร์มงบประมาณ/รายละเอียด **ไม่แสดงฟอร์มแก้ไข เห็นเฉพาะค่าแบบอ่านอย่างเดียว** (เลือกผลนี้ ไม่ใช่ "ซ่อนทั้งหมด")
- role=`chief`/`head`/`superadmin` + tier default → `true` → ฟอร์มแสดงและใช้งานได้
- tier matrix override แคบ (เช่น เหลือ `superadmin`) + role=`chief` → `false` (อ่านจาก DB, ไม่ใช่ list ตายตัว)
- ถ้า `getTierRoles` throw → fail-closed เหลือ `superadmin` เท่านั้น (ตรงกับ `require-staff.ts:28-33`)

**เกณฑ์ผ่าน:** ตาราง role × action ตรงกับ `actions/cases.ts:88,133,157,187`; จำลอง tier override แคบ → UI แคบตาม; server ยัง reject ถ้าถูกเรียกตรง

### FLOW-03 — safe return path (ไม่แตะ `actions/cases.ts`)

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `src/lib/navigation.ts` (ใหม่) | **ACTION:** สร้างไฟล์ใหม่ 1 ไฟล์ — **MIRROR:** คัดลอก logic มาปรับจาก `liff-state-redirect.tsx:61-67` ไม่ใช่ import (ไฟล์ liff อยู่ใต้ Protected (PRD §3) ห้ามแก้แม้บรรทัดเดียว) — **IMPLEMENT:** `safeInternalPath(value: string \| undefined, fallback: string): string` — กติกา: (1) ขึ้นต้น `/` (2) ห้ามขึ้นต้น `//` (3) ห้ามมี `\\` (4) ห้ามเป็น absolute URL (5) **ห้าม path segment `..` ใด ๆ** — **VALIDATE:** สัญญา test §FLOW-03 6 เคส (`:165-171`) ทุกเคสผ่าน — **import ให้ consumer:** `import { safeInternalPath } from '@/lib/navigation';` |
| `src/app/admin/reports/page.tsx` | **ACTION:** เติม return param — **MIRROR:** คง pagination pattern เดิม (`:283-288`) — **IMPLEMENT:** row link (`:232`) เพิ่ม `?return=${encodeURIComponent(currentUrl)}` โดย `currentUrl` = reconstruct จาก `searchParams` ฝั่ง server (`/admin/reports?` + params ที่มีอยู่); Pagination คงพารามิเตอร์เดิม (`:283-288`) — **VALIDATE:** e2e `:173` กรองคิว → เปิดเรื่อง → กลับได้ตัวกรองเดิม |
| `src/app/admin/cases/[id]/page.tsx` | **ACTION:** รับ `return` param + ใช้กับ back link — **MIRROR:** `safeInternalPath` จาก `src/lib/navigation.ts` (import `@/lib/navigation` ข้างบน) — **IMPLEMENT:** รับ `return` ใน `searchParams` (`:34-37`) ผ่าน `safeInternalPath` — **`searchParams` ของ Next คืน `string \| string[] \| undefined`: ใช้ค่าแรกหรือ reject array ก่อนเข้า `safeInternalPath`**; back link (`:181-187`) ใช้ค่านั้นแทน `href="/admin/reports"` ตายตัว — **VALIDATE:** e2e กรองคิว → เปิดเรื่อง → กด "กลับ" (`:173`) |
| ฟอร์มใน `case-detail-client.tsx` | **ACTION:** ไม่ต้องเพิ่มงาน — **MIRROR:** N/A (ไม่มีการแก้) — **IMPLEMENT:** **ไม่ต้องมี hidden input `return`** — **VALIDATE:** เกณฑ์ผ่าน `:185` (ฟอร์มอื่นคงค่าได้โดยไม่ต้องมี hidden field) | — หลัง FLOW-04 ลบ redirect แล้ว ไม่มี path ที่ navigate ออกจากหน้า case (state ทั้งหมดอยู่ใน URL ของหน้าเอง) |

**สัญญา test (input → expected) ของ `safeInternalPath`:**
- `'/admin/reports?page=2&status=open'` → คืนเดิม
- `'//evil.com'` → `fallback`
- `'https://evil.com'` → `fallback`
- `'\\evil.com'` หรือมี `\\` → `fallback`
- `''` / `undefined` → `fallback`
- `'/admin/../secret'` → `fallback` (ห้าม path traversal)

**e2e:** กรองคิว (`/admin/reports?status=open&page=2`) → เปิดเรื่อง → กด "กลับ" (back link ที่ `cases/[id]/page.tsx:181-187`) → กลับมาหน้าเดิมพร้อมตัวกรอง/หน้าเดิม

### FLOW-04 — ไม่ทิ้งค่าฟอร์มอื่น (root fix: ลบ redirect)

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `src/app/admin/actions/cases.ts` | **ACTION:** ลบ redirect 8 จุด — **MIRROR:** ไม่มี — **IMPLEMENT:** ลบ `redirect('/admin/cases/{id}?ok=…')` ออกจาก success path ทั้ง 8 (`:60,81,101,122,147,177,201,233`); คง `revalidatePath`; return **shape เดิม `CaseActionState`** ที่มีอยู่ (`{ error: string \| null; success?: string }`) → `{ error: null, success: 'บันทึกข้อมูลเรียบร้อย' }` — **ห้ามสร้าง field ใหม่ `ok`/`message`** (client เดิมอ่าน `.error` อยู่แล้ว) — **VALIDATE:** เกณฑ์ผ่าน (`:185`) กรอก 2 ฟอร์ม → ค่าอีกฟอร์มยังอยู่ |
| `src/app/admin/cases/[id]/case-detail-client.tsx` | **ACTION:** refresh in-place — **MIRROR:** ไม่มี (เปลี่ยนพฤติกรรมใหม่) — **IMPLEMENT:** หลัง success เรียก `router.refresh()` และแสดง success banner ในฟอร์มที่บันทึก (ไม่ remount ทั้งหน้า); ฟอร์มอื่นคงค่าที่พิมพ์ — **VALIDATE:** เกณฑ์ผ่าน `:185` (กรอก 2 ฟอร์ม → บันทึกหนึ่ง → อีกฟอร์มยังอยู่ + ข้อมูลสะท้อนหลัง refresh) |
| `src/app/admin/cases/[id]/page.tsx` | **ACTION:** ลบ dead `?ok=` path ของหน้า case — **MIRROR:** ไม่มี — **IMPLEMENT:** **ลบ dead path** — ที่เกี่ยวข้องกับ case: `actions/cases.ts` 8 จุด (เจ้าของ `?ok=` ของหน้า case) เท่านั้น ไม่มี caller อื่น — ลบ `ok` จาก `searchParams` (`:34-37, 49`) และ `<SuccessToast ok={ok ?? null} />` (`:189`); ลบ export `SuccessToast` (`:424`) ออกจาก `case-detail-client.tsx` ด้วย; **ห้ามแตะ** `?ok=` ของหน้า users (`actions/users.ts:101,164,237,298`, `users/page.tsx:56` `UserSuccessToast`, `users.integration.test.ts:132,145`) |

**Risk:** `src/app/admin/actions/users.integration.test.ts:132,145` ต้องไม่โดนการเปลี่ยนแปลงนี้ (grep `?ok=` e2e ยืนยันว่าไม่มี e2e spec ไหน assert `?ok=` จริง)

**เกณฑ์ผ่าน:** กรอก 2 ฟอร์ม → บันทึกฟอร์มหนึ่ง → ค่าอีกฟอร์มยังอยู่; ข้อมูลที่บันทึกแล้วสะท้อนหลัง refresh

---

## 6. T3 — A11Y-01..04 (branch `fix/uxui-admin-a11y`)

### A11Y-01 — Drawer

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `src/hooks/use-media-query.ts` (ใหม่) | **ACTION:** สร้าง hook ใหม่ 1 ไฟล์ — **MIRROR:** **location reference เท่านั้น** (ไม่ใช่ pattern source — ไฟล์นั้นไม่มี `useSyncExternalStore`/`matchMedia`) — **IMPLEMENT:** `useSyncExternalStore` + `matchMedia` (ตัวอย่าง API จริง: `liff-state-redirect.tsx:102`, `reveal.tsx:29` — **อ่านอ้างอิงเท่านั้น ห้ามแก้ไฟล์ทั้งคู่**), initial `false` ตอน SSR เพื่อกัน hydration mismatch — **VALIDATE:** สัญญา test `:200-203` — **import ให้ consumer:** `import { useMediaQuery } from '@/hooks/use-media-query';` (convention ตาม `use-session-timeout` + test คู่ใน `src/hooks/`) |
| `src/components/admin/admin-layout.tsx` | **ACTION:** ผูก drawer กับ media query + focus management — **MIRROR:** `use-media-query.ts` ใหม่ (import `@/hooks/use-media-query` ข้างบน) — **IMPLEMENT:** ใช้ `useMediaQuery('(min-width: 1024px)')`; `inert={!isDesktop && !mobileOpen}` บน `<aside>` (`:98-107`); โฟกัสเข้า drawer เมื่อเปิด + คืนให้ปุ่ม hamburger เมื่อปิด; กัก Tab ด้วย handler บน container; เพิ่ม `aria-controls` ที่ปุ่ม (`:205-211`) — **VALIDATE:** สัญญา test `:200-203` |

**ห้ามแตะ** `src/components/site/brand-mark.tsx` (landing ใช้ร่วม)

**สัญญา test (input → expected):**
- `mobileOpen=false` + viewport < 1024 → `<aside>` มี `inert` (หรือ `aria-hidden` + `tabIndex={-1}` fallback), Tab ไม่เข้าเมนู
- `mobileOpen=true` → โฟกัสอยู่ใน drawer, Escape **หรือกด backdrop** ปิดและคืนโฟกัสให้ปุ่ม hamburger
- viewport ≥ 1024 → ไม่มี `inert` แม้ `mobileOpen=false` (desktop ถาวร)

### A11Y-02 — ปุ่มไฟล์

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `src/app/admin/files/files-client.tsx` | **ACTION:** แก้ class ปุ่มไฟล์ที่ `:93` — **MIRROR:** ไม่มี — **IMPLEMENT:** `:93` → `opacity-0 group-hover:opacity-100 focus-within:opacity-100` + แสดงตลอดบน pointer-coarse (Tailwind v4: `pointer-coarse:opacity-100` — ต้องใช้ Tailwind ≥ 4.1; รีโปนี้ `@tailwindcss/postcss ^4.1.0`, ติดตั้งจริง 4.3.1) — **VALIDATE:** สัญญา test `:211` |

**สัญญา test:** focus เข้า container ปุ่ม → wrapper `<div>` ที่ `files-client.tsx:93` มี class `focus-within:opacity-100` (assert **ที่ wrapper div ไม่ใช่ `<button>`** — ปุ่มไม่ได้แบก class เหล่านี้) และบน pointer coarse wrapper มี class `pointer-coarse:opacity-100` (assert ผ่าน class string ไม่ต้องทำ visual)

### A11Y-03 — Dialog scroll

**รายชื่อ caller ของ `src/components/ui/dialog.tsx` — ทั้งหมด 18 รายการ (production 17 + story 1):**

`src/components/admin/confirm-dialog.tsx`, `src/components/admin/detail-modal.tsx`, `src/components/admin/user-menu.tsx`, `src/app/admin/users/users-client.tsx`, `src/app/admin/chat/chat-client.tsx`, `src/app/admin/chat/_components/canned-manage-dialog.tsx`, `src/app/admin/chat/_components/transfer-dialog.tsx`, `src/app/admin/responsible/responsible-client.tsx`, `src/app/admin/master-data/master-data-client.tsx`, `src/app/admin/friends/friends-client.tsx`, `src/app/admin/citizens/citizens-client.tsx`, `src/app/admin/chatbot/canned-responses/canned-responses-client.tsx`, `src/app/admin/chatbot/broadcast/[id]/broadcast-detail-client.tsx`, `src/app/admin/chatbot/auto-replies/intent-section.tsx`, `src/app/admin/chatbot/auto-replies/auto-replies-client.tsx`, `src/app/admin/chatbot/broadcast/broadcast-client.tsx`, `src/app/admin/chatbot/reply-objects/reply-objects-client.tsx`, `src/components/ui/dialog.stories.tsx`

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `src/components/ui/dialog.tsx` | **ACTION:** เพิ่ม max-h/overflow ที่ base — **MIRROR:** base primitive เดิม (ห้าม break 17 production callers + 1 story) — **IMPLEMENT:** `DialogContent` (`:46`) เพิ่ม `max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain` — **VALIDATE:** dialog 375×600 + keyboard 400px (`:226`) |
| `src/components/admin/detail-modal.tsx:43`, `src/app/admin/chat/chat-client.tsx:227`, `src/app/admin/chatbot/reply-objects/reply-objects-client.tsx:198` (**line จะขยับหลัง T1 แตะไฟล์นี้ — หาด้วย selector `max-h-` ไม่ใช่ line number**) | **ACTION:** ลบ override ซ้ำ 3 จุด — **MIRROR:** ไม่มี — **IMPLEMENT:** ลบ `max-h-*`/`overflow-y-auto` ที่ซ้ำ เพื่อกัน 2 scrollbar — **VALIDATE:** dialog 375×600 ไม่มี 2 scrollbar (`:226`) |

**ตรวจ caller ทั้ง 17 ตัวข้างบน** ไม่มี caller ฝั่ง landing

**สัญญา test:** dialog เนื้อหาสูงเกินจอ (ทดสอบ `users-client.tsx` modal ที่เนื้อหายาวที่สุด บน viewport 375×600) → scroll ภายใน dialog ได้, ปุ่ม footer มองเห็น, ไม่มี 2 scrollbar ซ้อนกัน (assert ด้วย `getByRole('button')` ของ footer ว่า visible แม้ scroll แล้ว); **keyboard มือถือ:** `max-h-[calc(100dvh-2rem)]` ย่อตาม dvh อยู่แล้ว — เพิ่มบรรทัดใน test ยืนยันว่า footer ยัง visible เมื่อ viewport สูงเหลือ 400px (จำลอง keyboard)

### A11Y-04 — Session warning

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `src/components/admin/session-timeout-warning.tsx` | **ACTION:** แปลไทย + ผูก a11y + focus — **MIRROR:** ไม่มี — **IMPLEMENT:** แปล strings เป็นไทย (`:34,39-41,46,49`); เพิ่ม `aria-describedby="session-timeout-desc"` ที่ container (`:22-25`) **และเพิ่ม `id="session-timeout-desc"` ที่ `<p>` คำอธิบาย** (ปัจจุบัน `<p>` ไม่มี id — ถ้าไม่เติม `aria-describedby` จะชี้ไปที่ว่าง); ref + focus แรกเข้า dialog, กัก Tab, คืนโฟกัสเมื่อปิด — **VALIDATE:** สัญญา test `:236-240` |

**ไม่เพิ่ม dependency** (ไม่ต้องใช้ `@radix-ui/react-alert-dialog` ที่ยังไม่ได้ติดตั้ง)

**สัญญา test (input → expected):**
- mount dialog → focus อยู่ใน dialog (ไม่ใช่ element เดิม)
- Tab วนภายใน dialog, ไม่หลุดออก
- ปิด dialog → โฟกัสคืน element ที่เปิด
- ข้อความที่แสดงเป็นไทยทั้งหมด (assert ไม่มีอังกฤษใน `title`/`description`)

**Test strategy T3:** vitest + Testing Library (focus/inert/aria), Storybook a11y addon สำหรับ `dialog.stories.tsx`, e2e keyboard: Tab ผ่าน drawer ที่ปิดแล้วต้องไม่เข้าเมนู

---

## 7. T4 — NET-02/03/04 (branch `fix/uxui-admin-net`)

### Layer แชร์ (แก้ครั้งเดียว กระทบทุกหน้า)

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `src/app/admin/_lib/admin-api.ts` | **ACTION:** เพิ่ม `code` + thread `opts` ใน 14 methods + `request()` timeout — **MIRROR:** envelope pattern เดิม (`:381-386`) — **IMPLEMENT:** **แก้ type `ApiFail` (`:14`)** ให้เพิ่ม field `code?: 'SESSION_EXPIRED' \| 'FORBIDDEN' \| 'NETWORK' \| 'TIMEOUT' \| 'HTTP'`; method ที่ถูกใช้เป็น `load` callback รับ `opts?: { signal?: AbortSignal }` เป็นพารามิเตอร์เพิ่ม (optional — **ต้องเป็น object form ให้ตรงกับ type `load` ใน use-resource ด้านล่าง ไม่ใช่ positional signal**; call site ที่ส่ง function reference ตรง ๆ ไม่ต้องแก้ เพราะ function reference ตรงกับ type ใหม่) — **inventory จริงจาก `grep -n "load:"` ทั้ง 19 production ไฟล์** (นับเป็น **call-site**: 14 direct ref + 6 wrapper/adapter — ไฟล์มี 19 แต่ call-site มากกว่าเพราะบางไฟล์มีหลาย `useResource`; ไม่มี `getRichMenu` เพราะไม่ได้เป็น load callback): **methods ที่ต้องรับ `opts` แล้วส่ง signal ลง `request()` ทั้ง 14 ตัว** — `listFaq` (auto-replies-client.tsx:37), `listIntents` (intent-section.tsx:70, chatbot-dashboard-client.tsx:13, rich-menu-builder-client.tsx:49), `listBroadcasts` (broadcast-client.tsx:111), `listReplyObjects` (reply-objects-client.tsx:26, chatbot-dashboard-client.tsx:12, rich-menu-builder-client.tsx:48), `listRichMenus` (rich-menus-client.tsx:25, aliases-client.tsx:25, friends-client.tsx:128), `listMenuAliases` (edit-client.tsx:42, aliases-client.tsx:26, rich-menu-builder-client.tsx:50), `listMedia` (files-client.tsx:22), `listFriends` (friends-client.tsx:59), `listFriendEvents` (friends-history-client.tsx:22), `getHealth` (health-client.tsx:11), `getSettings` (settings-client.tsx:25), `getSystemSettings` (settings-client.tsx:28), `listApiConnections` (settings-client.tsx:29), `getLineQuota` (settings-client.tsx:30) — **นอกเหนือจากนี้ไม่ต้องแก้ ยกเว้น** `getIntent`/`getBroadcast`/`getFriend` ที่ต้องเพิ่ม `opts` ตาม wrapper ①②③ ด้านล่าง; method ที่ไม่ถูกใช้เป็น `load` callback เลย (เช่น `getRichMenu`) ไม่ต้องแตะ 401/403 แปลงก่อน envelope ดิบ (`:381-386`): 401 → `{ code: 'SESSION_EXPIRED', error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' }`, 403 → `{ code: 'FORBIDDEN', error: 'ไม่มีสิทธิ์ทำรายการนี้' }`; `request()` เพิ่ม timeout 15s (`:372-375`) รวมกับ signal ที่ caller ส่งมา; network rejection → `code: 'NETWORK'`; timeout → `code: 'TIMEOUT'` แยกต่างหาก — **ต้องแยก timeout ออกจาก caller abort ได้: เก็บ reference ของ timeout signal/controller แล้วเช็ค `if (abortRef.timedOut) code = 'TIMEOUT'` (หรือเทียบ `signal.reason === 'timeout'` เมื่อใช้ `AbortSignal.timeout`); caller abort (unmount/query เปลี่ยน) ต้อง return โดยไม่ตั้ง `error`/`errorCode` เลย** — **timeout ต้องมี fallback**: `typeof AbortSignal.timeout === 'function'` ? ใช้เลย : สร้าง `AbortController` + `setTimeout(abort, 15_000)` เอง (Safari < 17.4 โยน TypeError ถ้าเรียกตรง) เช่นเดียวกับ `AbortSignal.any` — **VALIDATE:** สัญญา test `:257-265` (401/403/NETWORK/TIMEOUT/abort-through-fetch) |
| **call site ของ load ที่ไม่ใช่ function reference ตรง ๆ** — **ACTION:** thread `opts` ผ่าน 6 wrapper/adapter — **MIRROR:** ไม่มี (แก้ call site เดิม) — **IMPLEMENT:** (ห้ามละเลย — 6 จุดนี้ทิ้ง `opts` เงียบ ๆ ถ้าไม่แก้ ทำให้ abort/timeout ไม่ทำงาน) | ① `src/app/admin/chatbot/auto-replies/[id]/intent-detail-client.tsx:22` `load: () => adminApi.getIntent(intentId)` → `load: (_q, opts) => adminApi.getIntent(intentId, opts)` **และเพิ่ม `opts` ให้ `getIntent` ด้วย (เพราะถูกใช้เป็น load callback ที่นี่)** ② `src/app/admin/chatbot/broadcast/[id]/broadcast-detail-client.tsx:122` `load: () => adminApi.getBroadcast(broadcastId)` → เติม `opts` + เพิ่ม `opts` ให้ `getBroadcast` ด้วย (เพราะถูกใช้เป็น load callback ที่นี่) ③ `src/app/admin/friends/[id]/friend-detail-client.tsx:21` `load: () => adminApi.getFriend(friendId)` → เติม `opts` + เพิ่ม `opts` ให้ `getFriend` ④ `src/app/admin/friends/[id]/friend-detail-client.tsx:24` `load: () => adminApi.listFriendEvents(friendId)` → `load: (_q, opts) => adminApi.listFriendEvents(friendId, opts)` (`listFriendEvents` อยู่ใน 14 ข้างบนแล้ว) ⑤ `src/app/admin/chat/_hooks/use-conversations.ts:41` `load: loadConversationsAdapter` — adapter ตัวนี้เรียก fetch เองไม่ผ่าน `adminApi` → เปลี่ยน signature เป็น `(_query: string, opts?: { signal?: AbortSignal })` แล้วส่ง `opts.signal` เข้า `fetch(..., { signal })` ใน `loadConversationsAdapter` ⑥ `src/app/admin/chatbot/canned-responses/canned-responses-client.tsx:44` `load: async () => {...}` เรียก `fetchCannedResponses(true)` เอง → เปลี่ยนเป็น `async (_q, opts) =>` และส่ง `opts.signal` ผ่าน `fetchCannedResponses` ลง `fetch` |
| `src/app/admin/_lib/use-resource.ts` | **ACTION:** เปลี่ยน `load` type + เพิ่ม `error`/`errorCode` + แยก `notify` error/success — **MIRROR:** ไม่มี — **IMPLEMENT:** เปลี่ยน type ของ `load` เป็น `(query: string, opts?: { signal?: AbortSignal }) => Promise<ApiResult<TData>>` (`:26` — **object form ให้ตรงกับ adminApi ด้านบน; ห้ามเป็น positional `(query, signal)` เพราะ `load: adminApi.listX` จะ typecheck ไม่ผ่านและ `opts.signal` จะ undefined → abort ไม่ทำงาน**; **ไม่เปลี่ยนพารามิเตอร์แรกของ method ที่มีอยู่**: methods ที่มีพารามิเตอร์แรกอยู่แล้ว (`listFaq(query = '')`, `listFriends(query)`, `listBroadcasts(query?)`, `listFriendEvents(friendId?)`) → เติม `opts?: { signal?: AbortSignal }` เป็นพารามิเตอร์ที่สอง; methods ที่วันนี้ไม่มีพารามิเตอร์ (`listIntents`, `listReplyObjects`, `listRichMenus`, `listMenuAliases`, `listMedia`, `getHealth`, `getSettings`, `getSystemSettings`, `listApiConnections`, `getLineQuota`) → **เพิ่ม query slot ที่ไม่ถูกใช้เป็นพารามิเตอร์แรก: `(query = '', opts?: { signal?: AbortSignal })`** — **จำเป็น: load type คือ `(query: string, opts?)` และ tsconfig `strict: true` (`strictFunctionTypes`) ปฏิเสธ signature ที่ `opts` เป็นพารามิเตอร์แรก; ถ้าเขียน `listIntents(opts?)` แล้ว `load: adminApi.listIntents` จะ `tsc --noEmit` fail**; **GOTCHA `listFriendEvents`:** ถูกใช้เป็น direct load ref ที่ `friends-history-client.tsx:22` ซึ่ง `useResource` ส่ง search query เข้า slot แรก (`friendId`) อยู่แล้ว — **คงพฤติกรรมเดิมไว้ (ไม่แก้ semantics ใน tranche นี้) เพียงเติม `opts` เป็นพารามิเตอร์ที่สอง** และ wrapper ④ (`friend-detail-client.tsx:24`) ยังส่ง `friendId` เองตามเดิม); `useResource` สร้าง `AbortController` ต่อ load cycle และเรียก `controller.abort()` ใน effect cleanup (unmount / query เปลี่ยน) แล้วเรียก `load(query, { signal: controller.signal })` **ทั้ง 2 call site** (`:106` ใน `reload` และ `:143` ใน effect runner) — call site ที่ส่ง function reference ตรง ๆ (`load: adminApi.listX`) ไม่ต้องแก้เพราะ optional; **in-flight guard ของ `mutate()` (`:115-131`) มีขอบเขตแคบ: กันเรียก `mutate()` ซ้อนกันในตัว hook เอง (ถ้า in-flight อยู่ให้ return `false` ทันที ไม่เรียก `fn()` ซ้ำ) — ส่วนการ disable ปุ่มรายปุ่มยังเป็น per-file guard ข้างล่าง (คนละชั้น ไม่ทับกัน)**; **แก้ `notify()` ให้แยก success กับ error (ฟันธง — ห้ามตีความอื่น):** `notify('success', …)` → set `feedback` + timer auto-clear ตาม `FEEDBACK_MS` (`:22`) เท่านั้น; `notify('error', …)` → set **ทั้ง** `feedback` (banner inline ต่อฟอร์ม — คงสัญญา FORM-03 เดิม, auto-clear ตาม timer) **และ** `error`/`errorCode` (persistent — ไม่มี timer; clear เมื่อ request ถัดไปสำเร็จ) — เหตุผล: NET-02 บังคับว่า error ต้องไม่หายเอง ขณะที่ FORM-03 T1 อ่าน `feedback`; การ set ทั้งคู่ทำให้ T1 ไม่ต้องแก้ และ T4 มี persistent source ให้ `AdminErrorState` (โค้ดปัจจุบัน `:80-88` ตั้ง timer 4s ทั้ง 2 type); **เพิ่ม 2 field ใหม่ใน `UseResourceResult` — ปัจจุบันไม่มีทั้งคู่** (type ปัจจุบัน `:33-46` มีแค่ `data/loading/feedback/notify/clearFeedback/reload/mutate/setData`; error วันนี้ไปทาง `feedback` ที่ auto-clear ตาม `FEEDBACK_MS` เท่านั้น): **`error: string | null` (field ใหม่ ไม่ใช่ "คงเดิม")** (set จาก load ที่ fail — ทั้งใน `reload` `:106` และ effect runner `:143` — และ clear เมื่อ load ถัดไปสำเร็จ; **แยกจาก `feedback` โดยสิ้นเชิง**; `feedback` ยัง auto-clear ตามเดิมสำหรับ success) และ **`errorCode?: ApiFail['code']`** (คู่กับ `error`, clear พร้อมกัน) — **ต้องเพิ่ม type import: `import type { ApiFail, ApiResult } from './admin-api';` (ปัจจุบัน `:4` import แค่ `ApiResult`)** — `AdminErrorState` branch ที่ `errorCode === 'SESSION_EXPIRED'` อ่านจาก hook นี้ ไม่ใช่ local state รายหน้า | |
| `src/app/admin/_lib/admin-api.test.ts`, `use-resource.test.ts` | **ACTION:** เพิ่มเคส 401/403/timeout/persistence — **MIRROR:** test เดิม `:159-172` — **IMPLEMENT:** เพิ่มเคส 401/403 จริง (ไม่ใช่แค่ fallback), timeout, error persistence — **test เดียวใน `use-resource.test.ts:159-172` ปัจจุบัน assert ทั้ง success และ error ว่าหายใน 4s: แก้เฉพาะฝั่ง error (error ต้องคงค้าง); ฝั่ง success ยัง auto-clear ตาม `FEEDBACK_MS` ต้องคง assertion เดิม** |

**สัญญา test (input → expected):**
- 401 → `error === 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'`, `code === 'SESSION_EXPIRED'`
- 403 → `error === 'ไม่มีสิทธิ์ทำรายการนี้'`, `code === 'FORBIDDEN'`
- fetch reject (network down) → `code === 'NETWORK'`, `status === 0`
- เกิน 15s → `code === 'TIMEOUT'`
- 401 แล้วกด retry สำเร็จ → `error` ถูกเคลียร์
- unmount ระหว่าง request ค้าง → `controller.abort()` ถูกเรียก (spy) และไม่มี state update หลัง abort; **และ spy ต้องยืนยันว่า `opts.signal` ถูกส่งต่อถึง `load`/`fetch` จริง (assert ที่ stub ของ load หรือ `globalThis.fetch` ที่รับ `init.signal`) — ห้าม spy แค่ `AbortController.abort` อย่างเดียว เพราะเคสที่ signal หลุดสายจะผ่าน test เสมอ**
- เปลี่ยน query ก่อน request เดิมจบ → request เก่าถูก abort, ผลใหม่ทับเฉพาะ seq ล่าสุด
- arrow wrapper/adapter 6 จุด (intent-detail, broadcast-detail, friend-detail ×2, use-conversations, canned-responses) → test ละหนึ่งกรณียืนยัน signal ถูกส่งผ่าน (สำคัญกว่า direct ref เพราะเป็นจุดที่มักถูกลืม)

### UI รับ error

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `src/components/admin/admin-error-state.tsx` (ใหม่) | **ACTION:** สร้าง component ใหม่ 1 ไฟล์ — **MIRROR:** ไม่มี — เขียนใหม่ทั้งหมด — **IMPLEMENT:** แบนเนอร์ error กลาง + ปุ่ม Retry + ลิงก์กลับ login เมื่อ `errorCode === 'SESSION_EXPIRED'`; **2 variant** — `variant="card"` (default, แทน empty state เมื่อ `data === null`) และ `variant="inline"` (banner เล็กเหนือรายการเมื่อ `data !== null && error` — ใช้กับ mutation error หลัง T4) (รับ props `{ error: string; errorCode?: ApiFail['code']; onRetry: () => void; variant?: 'card' | 'inline' }` — `errorCode` อ่านจาก hook `useResource` ไม่ใช่ local state รายหน้า) — **VALIDATE:** เกณฑ์ `data === null && error && !loading` ด้านล่าง — **import ให้ consumer:** `import { AdminErrorState } from '@/components/admin/admin-error-state';` (convention ตาม `ConfirmDialog` ใน `@/components/admin/confirm-dialog`) |
| `src/app/admin/chatbot/rich-menus/rich-menus-client.tsx:25` (use `load`), `:79-87` (`items.length === 0` empty), `src/app/admin/files/files-client.tsx:21-23` (use `load`), `:76-79` (empty), `src/app/admin/friends/friends-client.tsx:58` (use `load`), `:231-233` (empty), `src/app/admin/chatbot/auto-replies/auto-replies-client.tsx:36-40` (use `load`), `:130-132` (empty), `src/app/admin/chatbot/rich-menus/aliases/aliases-client.tsx:25-26` (menus/aliases `load`), `:144-149` (empty), `src/app/admin/chatbot/broadcast/broadcast-client.tsx:110-114` (use `load`, เช็ค `data === null` ก่อน `loading`), `:243-246` (empty), `src/app/admin/chatbot/canned-responses/canned-responses-client.tsx:43-50` (inline `load`), `:155-158` (`data === null` แบบ3ทางแยกอยู่แล้ว — แก้ให้ error ขึ้นก่อน empty) | **ACTION:** ทั้ง 19 ไฟล์ production ต้อง render ทั้ง 2 variant — **ผูกพันครบ 19**; 7 ไฟล์ในตารางนี้คือจุดที่ rewrite หนักที่สุด (branch ยาวสุด) ส่วนที่เหลือทำแบบเดียวกันแต่สั้นกว่า; ปิดงานเมื่อ `grep -rl "AdminErrorState" src/app/admin | wc -l` = 19 — **MIRROR:** template ด้านล่าง — **IMPLEMENT:** แยก `error` ออกจาก `empty`: **`data === null && error && !loading` → `AdminErrorState`** (ทุกไฟล์ต้อง destructure `error`/`errorCode` เพิ่มจาก hook; `!loading` บังคับ — กัน error โผล่ระหว่าง request แรก; ไฟล์ที่เช็ค `items.length === 0` ต้องเช็ค error ก่อน empty) — **VALIDATE:** สัญญา test NET-02/03 (`:257-265`) + ไม่มี empty แทน error |

**Error branch template (copy ได้ — pattern จาก `rich-menus-client.tsx:25,79-87`):**

```tsx
// **IMPLEMENT:** วาง template นี้แทน branch `items.length === 0` เดิม — error ต้องขึ้นก่อน empty
import { AdminErrorState } from '@/components/admin/admin-error-state';
// destructure เพิ่ม: const { data, loading, error, errorCode, reload } = useResource({ load: adminApi.listX });

{loading ? (
  <div className="py-12 text-center text-muted">กำลังโหลดข้อมูล...</div>
) : error && data === null ? (
  <AdminErrorState error={error} errorCode={errorCode} onRetry={() => void reload()} />
) : items.length === 0 ? (
  /* empty เดิมคงไว้ */
) : ( /* list เดิม */ )}
```

**Skeleton `src/lib/navigation.ts` (copy ได้ — MIRROR: ปรับจาก `liff-state-redirect.tsx:61-67`):**

```ts
export function safeInternalPath(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith('/')) return fallback; // กติกา (1)
  if (value.startsWith('//')) return fallback; // กติกา (2)
  if (value.includes('\\')) return fallback; // กติกา (3)
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return fallback; // กติกา (4) absolute URL
  if (value.split('/').includes('..')) return fallback; // กติกา (5) path segment ..
  return value;
}
```


**เกณฑ์ตัดสิน empty-vs-error ทุกหน้าที่ใช้ `useResource` (ครบทั้ง 19 production ไฟล์ — path เต็มทุกตัว; `grep -rln "useResource(" src` = 21 ไฟล์ หัก 2 test = 19):**
`src/app/admin/chat/_hooks/use-conversations.ts`, `src/app/admin/chatbot/auto-replies/[id]/intent-detail-client.tsx`, `src/app/admin/chatbot/auto-replies/auto-replies-client.tsx`, `src/app/admin/chatbot/auto-replies/intent-section.tsx`, `src/app/admin/chatbot/broadcast/[id]/broadcast-detail-client.tsx`, `src/app/admin/chatbot/broadcast/broadcast-client.tsx`, `src/app/admin/chatbot/canned-responses/canned-responses-client.tsx`, `src/app/admin/chatbot/chatbot-dashboard-client.tsx`, `src/app/admin/chatbot/reply-objects/reply-objects-client.tsx`, `src/app/admin/chatbot/rich-menus/[id]/edit/edit-client.tsx`, `src/app/admin/chatbot/rich-menus/aliases/aliases-client.tsx`, `src/app/admin/chatbot/rich-menus/new/rich-menu-builder-client.tsx`, `src/app/admin/chatbot/rich-menus/rich-menus-client.tsx`, `src/app/admin/files/files-client.tsx`, `src/app/admin/friends/[id]/friend-detail-client.tsx`, `src/app/admin/friends/friends-client.tsx`, `src/app/admin/friends/history/friends-history-client.tsx`, `src/app/admin/health/health-client.tsx`, `src/app/admin/settings/settings-client.tsx`
— ทุกหน้าในนี้ต้อง render `AdminErrorState` สองกรณี: **variant `card`** เมื่อ **`data === null && error && !loading`** (ต้องมี `!loading` กัน error state โผล่ระหว่าง request แรกที่ยังไม่จบ; แทน empty state) และ **variant `inline`** เมื่อ **`data !== null && error`** (mutation error จาก `notify('error')`); หน้าที่มี behavior พิเศษ (health poll, chat hooks) ปรับตาม context เฉพาะหน้าแต่เกณฑ์ error-vs-empty คงเดิม
| `src/app/admin/chatbot/rich-menus/[id]/edit/edit-client.tsx:69-78,84-93` | **ACTION:** แยก not-found ออกจาก error — **MIRROR:** ไม่มี — **IMPLEMENT:** หยุดตี error เป็น `notFound`; แยก 404 ออกจาก 401/500/offline (`404 → notFound branch`, อื่น → `AdminErrorState` ผ่าน `error`/`errorCode` จาก hook) — **VALIDATE:** สัญญา test NET-03 (`:259-265`: 401 → SESSION_EXPIRED, NETWORK/TIMEOUT; 404 ยังไป notFound) |
| `src/app/admin/chatbot/broadcast/[id]/broadcast-detail-client.tsx:148-149` | **ACTION:** แยก not-found ออกจาก error — **MIRROR:** เช่นเดียวกับ edit-client ข้างบน — **IMPLEMENT:** เช่นเดียวกัน — **VALIDATE:** เช่นเดียวกับ edit-client ข้างบน |

### NET-04 — กันซ้ำ + กัน error หลุด

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `src/app/admin/error.tsx` (ใหม่) | **ACTION:** สร้าง error boundary ระดับ admin — **MIRROR:** ไม่มี — **IMPLEMENT:** ไฟล์นี้ต้องขึ้นต้นด้วย `'use client'` (Next error boundary เป็น client component — ถ้าไม่มี build fail) แล้ว `export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void })`; ข้อความไทย + ปุ่ม "ลองใหม่" (เรียก `reset()`) + ลิงก์ "กลับแดชบอร์ด" (`href="/admin"`); log `console.error(error)` และแสดง `error.digest` — ห้าม swallow — **VALIDATE:** mock `reset()` → เรียกได้; assert label 2 ปุ่ม (`:325-329`) |
| pending guards: `rich-menus-client.tsx:40-42`, `aliases-client.tsx:53-62`, `reply-objects-client.tsx:58-80` (**ทำใน T1 แล้ว — T4 เพียง verify ว่า guard ยังอยู่หลัง rebase ห้ามเขียนซ้ำ/ทับ**), `intent-section.tsx:161-169`, `intent-detail-client.tsx:33-42`, `settings-client.tsx:92-94`, `users-client.tsx:171-186` (**T1 ทำแล้ว — T4 verify เท่านั้น**), `master-data-client.tsx:475-487` (**คนละ pattern: ที่นี่เป็น `<form action={toggleActive}>` server action ไม่ใช่ `useState` pending flag — ใช้ `useFormStatus` ใน child component ของ form หรือ `useTransition` ครอบ `startTransition(() => toggleActive(formData))` แล้ว disable ปุ่มตาม pending**) | **ACTION:** เพิ่ม in-flight guard — **MIRROR:** pending pattern `files-client.tsx:18,30-32` — **IMPLEMENT:** disable + in-flight flag ตาม pattern ที่มีอยู่ (`files-client.tsx:18,30-32`) สำหรับ mutation ที่เป็น client call — **VALIDATE:** สัญญา test NET-04 (`:325-329`: publish → disabled, กดซ้ำ → เรียกครั้งเดียว) |
| `src/app/admin/actions/queue.ts:56-72`, `master-data.ts:208,252-262`, `responsible.ts:119-129,146-150` | **ACTION:** ครอบ try/catch — **MIRROR:** action ที่ครอบแล้ว (`users.ts`) — **IMPLEMENT:** ครอบ DB write ด้วย try/catch คืน `{ error }` แบบไทย (ไม่ปล่อยให้ Next แสดงหน้า error ดิบ) — **VALIDATE:** สัญญา test NET-04 (`:325-329`: DB throw → return `{ error }` ไม่หลุดเป็น unhandled rejection) |

**สัญญา test NET-04 (input → expected):**
- `src/app/admin/error.tsx` — mock `reset()` → เรียกได้; แสดงข้อความไทย; มีปุ่ม "ลองใหม่" และ "กลับแดชบอร์ด" (assert label)
- pending guard (ทดสอบผ่าน `rich-menus-client.tsx` ตัวอย่างหนึ่ง) — กด publish → `disabled` ระหว่าง in-flight; กดซ้ำเร็ว → action ถูกเรียกครั้งเดียว
- try/catch (`actions/master-data.ts` ตัวอย่างหนึ่ง) — ให้ DB throw → action return `{ error: 'ข้อความไทย' }` ไม่หลุดเป็น unhandled rejection

**path เต็มที่อ้าง (กันเดา):** `src/app/admin/settings/settings-client.tsx`, `src/app/admin/chatbot/auto-replies/[id]/intent-detail-client.tsx`, `src/app/admin/chatbot/rich-menus/[id]/edit/edit-client.tsx`, `src/app/admin/master-data/master-data-client.tsx`

**ไม่ทำ:** idempotency key (ไม่มีในระบบ; ต้องออกแบบสัญญา server ก่อน — บันทึกเป็น follow-up), auto-retry (ห้าม)

**Test strategy T4:** vitest unit ของ `admin-api`/`use-resource` + e2e จำลอง 401/500 ด้วย route interception; ตรวจว่า empty ไม่ถูกแสดงแทน error

---

## 8. ความเสี่ยงและการรับมือ

| ความเสี่ยง | การรับมือ |
|---|---|
| แก้ `ui/dialog.tsx` กระทบ 18 caller | ไล่ caller ทุกตัวตามรายชื่อ §6 A11Y-03, ลบ override ซ้ำ 3 จุด, ทดสอบ dialog ที่เนื้อหายาวที่สุด (`users-client`) บน 375×600 |
| `AbortSignal.timeout`/`AbortSignal.any` ไม่มีใน Safari < 17.4 (โยน TypeError ทุก request) | feature-detect แล้ว fallback เป็น `AbortController` + `setTimeout` เอง (ระบุใน §7 admin-api row) |
| T4 แตะไฟล์เดียวกับ T1 | merge T1 ก่อน, rebase T4; ห้ามทำขนาน |
| ลบ redirect ใน `cases.ts` ทำ E2E เดิมพัง | `grep -rn "?ok=" e2e src` ก่อนแก้, อัปเดต spec พร้อมกันใน PR เดียว |
| tier matrix อ่าน DB ไม่ได้ | helper ต้อง fail-closed เหมือน server (`require-staff.ts:28-33`) ไม่ใช่ขยายสิทธิ์ |
| `inert` ไม่รองรับ browser เป้าหมาย | React 19 รองรับ attribute; เพิ่ม `aria-hidden` + `tabIndex={-1}` fallback ใน component เดียวกัน |
| Error boundary อาจกลืน error ที่ควรเห็น | `error.tsx` แสดง `error.digest` และ log ด้วย `console.error` (eslint allow) ไม่ swallow |
| Baseline ผูกกับข้อมูลจริง (สถิติ/ปีงบประมาณ) | seed คงที่ + ระบุใน README ว่า element ใดไม่ถูกเทียบ |

## 9. Test plan รวม

- **Unit/contract (vitest):** ทุกไฟล์ที่แก้ต้องมี test ที่ fail ก่อนแก้และผ่านหลังแก้; contract test สำคัญ = `broadcasts` POST status (ไฟล์ใหม่ `src/app/api/line/admin/broadcasts/route.contract.test.ts`), `safeInternalPath` (ทุกเคสใน §5), `admin-api` 401/403/timeout (ทุกเคสใน §7), `use-resource` error persistence, permission helper (ทุกเคสใน §5 FLOW-01)
- **Integration (ต้องมี Docker):** `npx vitest run --config vitest.integration.config.ts` สำหรับ settings/session-related ที่แตะ
- **E2E (Playwright):** เพิ่ม spec ใหม่ 1 ไฟล์ต่อ tranche
  - `e2e/admin-form-feedback.spec.ts` — ระงับบัญชี, draft broadcast
  - `e2e/admin-case-flow.spec.ts` — RBAC ฟอร์ม, return filters, 2 ฟอร์ม
  - `e2e/admin-a11y.spec.ts` — keyboard drawer, dialog บนจอเตี้ย
  - `e2e/admin-net-errors.spec.ts` — 401/500 interception, empty vs error
- **Browser matrix:** 375×812, 1440×900, 1280×600 (จอเตี้ย), zoom 200%, reduced motion
- **บทบาท:** officer, chief, head, superadmin (seed ตาม `ALL_ROLES` ใน `src/lib/auth/roles.ts:11` — **ไม่มี role `admin`**) + บัญชีถูกระงับ; officer ต้องเห็นฟอร์มแบบอ่านอย่างเดียว (negative case ของ FLOW-01)
- **หลีกเลี่ยง:** ส่งข้อความ LINE จริง — mock/intercept หรือใช้ draft เท่านั้น

## 10. Checklist ก่อนส่งแต่ละ tranche

```
[ ] ไม่มี diff ในไฟล์ protected (§3 ของ PRD)
[ ] ภาพ baseline หน้าแรกก่อน–หลังเท่ากัน หรือรายงานว่ายืนยันไม่ได้
[ ] npx tsc --noEmit / npx eslint . / npx vitest run / npx tsx scripts/check-contrast.ts ผ่าน
[ ] npx next build ผ่าน (จับ SSR boundary, error.tsx export, action return shape ที่ tsc ไม่เห็น)
[ ] npx tsx scripts/verify-env.ts ผ่าน (env gate — รันใน `next build` อยู่แล้ว เรียกแยกได้เร็วกว่า)
[ ] test ใหม่ fail ก่อนแก้ (แสดงหลักฐานใน PR)
[ ] ไฟล์ที่แก้ ≤ ขอบเขตในแผน: ไม่มี drive-by refactor
[ ] PR body: รหัสที่ปิด, หลักฐาน test, สิ่งที่ยังค้าง
```

## 11. สิ่งที่ยังค้าง/รออนุมัติ

- FLOW-02 (assignment vs status rule) — ต้องยืนยันกติกาธุรกิจ
- NET-01, FORM-04 — ต้องรับมอบหมายแยก (กระทบ public)
- FORM-05/06, A11Y-05 — ยังไม่อยู่ใน tranche; FORM-05 เกี่ยวเนื่องกับ ConfirmDialog ที่ T1 ใช้ ต้องตรวจพฤติกรรม pending ก่อนถือว่าปิด
- Idempotency key สำหรับ admin mutation — ต้องออกแบบสัญญา server
- Tranche F/G — ตามลำดับใน `docs/uxui-handoff.md`
