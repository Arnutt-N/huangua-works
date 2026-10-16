# Findings — รีวิว PR #117 (b0301ff) `fix(security): ปิด 5 HIGH + 6 MEDIUM/LOW จาก enterprise audit`

- วันที่: 2026-10-15
- ขอบเขต: diff ของ PR #117 (15 ไฟล์ +175/−30) + ปัญหาเดิมที่อยู่บนเส้นทาง threat model ที่ PR ระบุเอง
- Branch แก้: `fix/pr117-review-findings`
- Reviewers (อ่านอย่างเดียว ขนานกัน 4 ตัว + lead):
  - **SEC** = ecc:security-reviewer
  - **TS** = ecc:typescript-reviewer (correctness / Next.js 16 / @upstash/redis)
  - **TEST** = ecc:pr-test-analyzer
  - **SPEC** = general-purpose (spec-vs-code + AGENTS.md standards)
  - **LEAD** = ผู้ประสานงาน (ตรวจซ้ำทุกข้อกับโค้ดจริง)
- Baseline ก่อนแก้ (`npx vitest run`, Docker ขึ้น): 1090/1094 ผ่าน — แดง 4 ตัวเป็น timeout 5000ms ใน integration 3 ไฟล์ (settings version, system-settings GET, cases/submit) ขณะเครื่องโหลดหนัก (collect 1574s)

สรุปหลังตัดซ้ำ: **High 2 · Medium 11 · Low 6** (รวม F20 ที่พบระหว่าง plan gate รอบ 1) (รับแก้ 17 รวม F20, เลื่อน 2, ปัดตก 2 ข้อย่อย)

> หมายเหตุเลข: ไม่มี F7 — ร่างแรกเป็น "test gap รวม" ซึ่งตัดซ้ำแล้วกระจายเข้าข้อของ area นั้น ๆ (F1 require-staff catch, F3 authorize/login, F8 cid-hmac, F9 close-stale, F10 intake, F11 token-expiry, F5 broadcaster) — ทุก test gap ที่ reviewer รายงานจึงมีเจ้าของ

---

## High

### F1 — "tier matrix fail-closed" ไม่ได้ implement จริง: เปลี่ยนแค่ comment พฤติกรรมยัง fail-open
- **Location:** `src/lib/auth/require-staff.ts:27-31`, `src/lib/auth/tiers.ts:76-85`
- **Reporters:** SEC (M), TS (M), TEST (H), SPEC (H), LEAD — 5
- **Evidence:** `git show b0301ff -- src/lib/auth/require-staff.ts` เปลี่ยนเฉพาะ comment + ข้อความ log; `return allowedRoles;` เหมือน b0301ff^ ทุกไบต์ `tierKeyForRoles()` (tiers.ts:50) คืน key เฉพาะเมื่อ whitelist ของ caller **เท่ากับ** `TIER_DEFAULTS[key]` ดังนั้น "caller whitelist" = ค่าคงที่ compiled default ซึ่ง **กว้างกว่า** override ที่แอดมินตั้งแคบได้ (`setTierRoles`) นอกจากนี้ `loadTierMap` (tiers.ts:80-85) กลืน error ของ select เองแล้วคืน `TIER_DEFAULTS` ซึ่งถูก cache ต่อได้ถึง 60 วินาที — catch ใน resolveAllowedRoles แทบไม่ถูกเรียก
- **Category:** logic-error / vulnerability (claimed security fix not implemented + § comment เท็จ)
- **Root cause:** ผู้เขียน PR เข้าใจว่า `allowedRoles` แคบกว่า fallback แต่จริง ๆ คือตัวเดียวกัน และไม่ได้แตะเส้นทาง fail-open ตัวจริงใน `loadTierMap`
- **Disposition:** ACCEPT — ทำ fail-closed จริง: (1) `loadTierMap` แยก `42P01 undefined_table` (ตารางยังไม่มี = ไม่มี override → default ถูกต้องตามนิยาม) ออกจาก error อื่น (rethrow ไม่ cache) (2) catch ใน `resolveAllowedRoles` คืน `SUPERADMIN_ONLY` (superadmin อยู่ทุก tier ตาม invariant #111 — ระบบไม่ล็อกทั้งหมด) + test ทั้งสองเส้นทาง
- **Hazard ที่ตรวจแล้ว:** `/admin/page.tsx:33` เรียก `requireStaff()` ไม่มี whitelist → ไม่ผ่าน tier → redirect `insufficient_role` → `/admin` ไม่วนลูป

### F2 — POST ตรงไป `/api/auth/callback/credentials` ข้าม rate limit ของ login (เส้นทางที่ PR ระบุเองว่าเป็นช่องโหว่)
- **Location:** `src/app/api/auth/[...nextauth]/route.ts:9`, `src/auth.ts:89` (comment อ้าง rate-limit ใน actions.ts)
- **Reporters:** SEC (H), SPEC (H), LEAD — 3
- **Evidence:** route export `handlers` ตรง ๆ; rate limit `adminLoginIp`/`adminLoginEmail` อยู่ใน `src/app/admin/actions.ts:42-45` เท่านั้น ผู้โจมตีขอ CSRF token จาก `/api/auth/csrf` แล้วยิง callback ได้ไม่จำกัด (bcrypt ทุกครั้ง) — LEAD ตรวจ `next-auth/lib/actions.js:43-44` แล้ว: `signIn()` ใน server action เรียก `Auth(req, {...config, raw, skipCSRFCheck})` **ใน process** ไม่ผ่าน HTTP route → แอปไม่มีผู้ใช้ HTTP credentials callback เลย; `@auth/core/lib/utils/web.js:91-108` parse path ด้วย `^/api/auth(.+)` → `split('/').filter(Boolean)` → `['callback','credentials']`
- **Category:** vulnerability (pre-existing แต่อยู่บน threat path ที่ PR ระบุ และ PR ปิดแค่ผลข้างเคียงเดียว)
- **Disposition:** ACCEPT — บล็อก POST ที่ parse ได้เป็น `callback/credentials` (mirror กฎ parse ของ @auth/core) ตอบ 404 ใน route; server action เป็นทางเข้าเดียว (มี rate limit + audit)

## Medium

### F3 — Login regression: บัญชีระงับ/ประชาชนที่รหัสถูก เห็น "รหัสผ่านไม่ถูกต้อง" + audit ปน brute-force metric
- **Location:** `src/auth.ts:97`, `src/app/admin/actions.ts:68-115`
- **Reporters:** SEC (M), TS (M), TEST (M), SPEC (M), LEAD — 5
- **Evidence:** authorize คืน null → `signIn` throw `CredentialsSignin` → action คืน 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' + `LOGIN_FAILURE {reason:'invalid_credentials'}` (actions.ts:76-82) — branch 94-115 ('บัญชีนี้ถูกระงับการใช้งาน', `ACCESS_DENIED` reason inactive/citizen_role) ตายแล้ว ขัด § comment 98-99 ที่ตั้งใจแยก SIEM metric; `.claude/skills/verify/features/admin-auth.md:54` ยังคาดหวังข้อความเฉพาะ
- **Root cause:** ย้ายการตัดสิน eligibility เข้า authorize โดยไม่มีช่องส่ง "เหตุผล" กลับให้ action
- **Disposition:** ACCEPT — authorize throw subclass ของ `CredentialsSignin` (`IneligibleAccountSignin`, code = `citizen_role|inactive`) หลัง bcrypt ผ่าน (ไม่ใช่ oracle — ยืนยันรหัสแล้ว และ F2 ปิด HTTP path ที่ code จะโผล่ใน URL) action map เป็นข้อความเฉพาะ + `ACCESS_DENIED` + test

### F4 — เอกสาร/§ comment ขัดกับพฤติกรรมใหม่ของ authorize
- **Location:** `AGENTS.md:197` (Auth section), `src/auth.ts:21-23`, `src/auth.ts:89`, `src/app/admin/actions.ts:20-24`, `:87-88`, `src/proxy.ts:15-16`, `src/lib/auth/tiers.ts:1-8` (หลัง F1)
- **Reporters:** SEC (L), SPEC (M ×2), TS (ใน M), LEAD — 4
- **Evidence:** AGENTS.md: "authorize() deliberately does not check role/isActive" — โค้ดเช็คแล้ว; auth.ts header "§ authorize() ไม่ทำ role/isActive check" อยู่เหนือบรรทัดที่เช็คเอง
- **Disposition:** ACCEPT — แก้ทุกจุดให้ตรงพฤติกรรมหลัง F1-F3

### F5 — SSE "เปิดทางต่อใหม่ ไม่หลุด cross-process เงียบ" ไม่เป็นจริง
- **Location:** `src/lib/line/sse/broadcaster.ts:41-55`
- **Reporters:** TS (M + L), SPEC (M), TEST (M), LEAD — 4
- **Evidence:** LEAD ตรวจ `@upstash/redis@1.38.0/nodejs.js:232-265`: stream SSE อ่านใน IIFE แยก — `done` แค่ break เงียบ, read error แค่ `console.error('Stream reading error')` ไม่ dispatch `'error'` ให้ Subscriber → stream ขาดหลังต่อติดแล้ว handler ของ PR ไม่ถูกเรียก, `subscriberStarted` ค้าง true ตลอดชีวิต process; แม้ error ยิงจริง ก็ต่อใหม่แบบ lazy (ต้องมี client ใหม่) และไม่ `unsubscribe()` ตัวเก่า → อาจ deliver ซ้ำ; client (`use-chat-sse.ts`) refetch เฉพาะตอน reconnect ไม่มี polling สำรอง
- **Disposition:** ACCEPT — heartbeat watchdog ผ่าน loopback ping (Redis ส่ง publish กลับหาผู้ publish เอง): ขาด loopback เกินเกณฑ์/มี error → unsubscribe ตัวเก่า + subscribe ใหม่ โดยไม่ต้องรอ client ใหม่; หยุดเมื่อไม่มี listener; ping ไม่ถูกส่งให้ client; test ด้วย fake redis + fake timers

### F6 — test legacy dedup เป็น tautology และ `checkDuplicate` ไม่มี test เส้นทาง legacy
- **Location:** `src/lib/cid-hmac.test.ts:80-87`, `src/lib/dedup.ts:25-38`
- **Reporters:** TEST (M ×2), TS (L), LEAD — 3
- **Evidence:** `expect([newHash, oldHash]).toContain(oldHash)` ผ่านเสมอ; ไม่มี dedup test; intake.test.ts mock `@/lib/dedup` ทั้งโมดูล
- **Disposition:** ACCEPT — แทนด้วย golden vector (HMAC ของสูตรเก่าคำนวณอิสระ) + `src/lib/dedup.integration.test.ts` (แถว hash สูตรเก่า → `isDuplicate:true`, หมดอายุ → false, whitespace-variant จับด้วยสูตรใหม่)

### F8 — cid-hmac: § comment ให้เหตุผลผิด + comment ค้าง 2 จุด + ไม่มี test "key เปลี่ยนหลัง import"
- **Location:** `src/lib/cid-hmac.ts:12-13`, `src/lib/cid-hmac.test.ts:107-108`, `vitest.config.ts:12-14`
- **Reporters:** SPEC (M), TEST (M), LEAD — 3
- **Evidence:** b0301ff^ ใช้ `HMAC_KEY` ตัวเดียวกันทั้ง assert และ hash (ไม่มีกรณี "assert สดแต่ hash เก่า"); production key ว่าง → assert throw ไม่ได้ hash ด้วย key ว่าง; test เดิม `loadWith` reset module ทุกครั้ง → ผ่านทั้งโค้ดเก่าและใหม่
- **Disposition:** ACCEPT — แก้ § comment ให้ตรง (ประโยชน์จริง: env ที่ตั้งหลัง import เช่น scripts/tests และไม่มีค่าค้างจากตอน build) + แก้ comment ค้าง + test import ครั้งเดียวแล้วเปลี่ยน key

### F9 — close-stale: `.limit()` ไม่มี orderBy, `truncated` ไม่แม่น, ไม่มีใครอ่าน flag, ไม่มี test
- **Location:** `src/app/api/cron/close-stale/route.ts:24-30,59`
- **Reporters:** TEST (M), TS (L), SPEC (L), LEAD — 4
- **Evidence:** ไม่มี `orderBy` → เลือก 100 แถวแบบ planner; `>=` บอก truncated=true เมื่อเหลือพอดี 100; cron-job.org ไม่อ่าน body
- **Disposition:** ACCEPT — `orderBy(asc(updatedAt))`, ดึง `LIMIT+1` เพื่อรู้ว่ามีค้างจริง, `console.warn` เมื่อค้าง + unit test (mock db/operations/cron-auth)
- **Rejected sub-item:** "แถว fail ถาวร ≥100 แถวทำให้ backlog อดตาย" — ปัดตก: ความล้มเหลวของ `applyCaseUpdate` เป็นแบบชั่วคราว (DB error / สถานะเปลี่ยนแล้ว) ต้องมีแถวพังถาวร ≥100 จึงเกิด ไม่สมจริง

### F10 — intake: ด่าน identity มาหลัง DB query หลายรอบ, guard ใน tx เป็น dead code, comment อ้าง audit ผิด, ไม่มี test (รวม PDPA metadata)
- **Location:** `src/lib/cases/intake.ts:114-128,158-164`
- **Reporters:** TEST (M + L), TS (L), SPEC (L), LEAD — 4
- **Evidence:** pre-check อยู่หลัง category + dedup + tracking-code (สูงสุด 5 query); `citizenIdentityOf` pure + input ไม่ถูก mutate; ไม่มี path ไหนเขียน audit; ไม่มี assertion ว่า `cases.metadata` ไม่มี ipAddress/userAgent
- **Disposition:** ACCEPT — ย้ายด่านไปบนสุดของ `createCase`, ส่ง identity เข้า tx, ลบ guard ซ้ำ, `console.error` (ไม่มี PII), แก้ comment + test 2 กลุ่ม

### F11 — `isTokenExpired` ขอบ `<=` ไม่มี test
- **Location:** `src/lib/auth/token-expiry.ts:11`
- **Reporters:** TEST (M), SEC (L), LEAD — 3
- **Disposition:** ACCEPT — `token-expiry.test.ts` (T−1 → true, T → true, T+1 → false, undefined → false)

### F12 — webhook: § comment อ้างเหตุผล redelivery ผิด + event ผิดรูปยังทำทั้ง batch 500
- **Location:** `src/app/api/line/webhook/route.ts:56,67-80`, `route.test.ts:88`
- **Reporters:** SPEC (M), TS (L), TEST (L), LEAD — 4
- **Evidence:** LINE redeliver ทุกสถานะ non-2xx (เมื่อเปิด webhook redelivery) → 400 ไม่ได้กัน redeliver; `isDuplicateEvent(event)` อยู่นอก try ต่อ event → `events:[null]` หรือ `type:'message'` ไม่มี `message` → TypeError → `Promise.all` reject → 500
- **Disposition:** ACCEPT — คง 400 (ความหมาย HTTP ถูก) แต่แก้ § comment/ชื่อ test ให้ตรง; ข้าม event ที่ไม่ใช่ object และย้าย `isDuplicateEvent` เข้า try + test
- **Rejected sub-item:** "ตอบ 200 กับ body ที่ parse ไม่ได้เพื่อหยุด redelivery" — ปัดตก: body ผ่าน signature แล้ว (มาจาก LINE จริง) การ parse ไม่ได้แทบเป็นไปไม่ได้ และ 200 จะกลบความผิดปกติ

### F13 — signature: § comment กลับด้าน, try/catch ตาย, decode แบบหลวมรับ encoding ไม่ canonical
- **Location:** `src/lib/line/signature.ts:7-17`, `signature.test.ts:69-74`
- **Reporters:** SEC (L), TS (L), TEST (L), SPEC (M), LEAD — 5
- **Evidence:** `Buffer.from(s,'base64')` ไม่ throw และรับ unpadded / url-safe / ขยะปน → decode ได้ 32 bytes เท่ากัน (SEC/SPEC ทดสอบบน Node v24); โค้ดเดิม (เทียบ base64 string) ยอมเฉพาะรูป canonical; ไม่ forge ได้ (HMAC ต้องตรง) แต่ malleable; test malformed เช็คแค่ `not.toThrow`
- **Disposition:** ACCEPT — กลับไปเทียบ base64 string canonical (ตรรกะเดิมก่อน PR) พร้อม § comment ที่ถูก + test ปฏิเสธรูปไม่ canonical และ malformed → `false`

### F20 — header `X-Auth-Return-Redirect` ทำให้ signIn ไม่ throw → login action ถือว่ารหัสถูก
- **Location:** `src/app/admin/actions.ts:59-87`
- **Reporters:** plan-gate Reviewer B (IMPORTANT), LEAD (ตรวจซ้ำ)
- **Evidence:** `@auth/core/index.js:108,124-125` throw AuthError เฉพาะเมื่อ request ไม่มี header นี้ ถ้ามีจะคืน `Response.json({url})`; `next-auth/lib/actions.js:7,48-54` copy header ของ request ขาเข้า และคืน url ปกติ → `signInOk = true` → รหัสผิดของ staff ที่มีอยู่ได้ `LOGIN_SUCCESS` + `success:true` (ไม่มี cookie) ส่วนอีเมลที่ไม่มีได้ข้อความ no_staff_record = enumeration oracle + audit ปลอม
- **Category:** vulnerability (pre-existing, อยู่ใน flow ที่ T4 แก้)
- **Disposition:** ACCEPT — login action ปฏิเสธ request ที่มี header นี้ก่อนเรียก signIn (server action ไม่มีผู้ใช้ header นี้โดยชอบ) + test

## Low

### F14 — ถอด `setMaxListeners(100)` → warn หลอกเมื่อ SSE พร้อมกันเกิน 10 ใน process เดียว
- **Location:** `src/lib/line/sse/broadcaster.ts:5-7`
- **Reporters:** TS (L), SPEC (L), TEST (ใน M), LEAD — 4
- **Evidence:** 1 listener ต่อ SSE connection (`subscribe` บรรทัด 59) — staff ~10-20 คน หลายแท็บ เกิน 10 ได้ตามปกติ
- **Disposition:** ACCEPT — คืนเพดานที่มีเหตุผลกำกับ (100) ทำพร้อม F5

### F15 — กฎ eligibility ซ้ำ 3 ที่ (roles.ts helper ใหม่ไม่ถูกใช้ใน resolveStaff/action)
- **Location:** `src/lib/auth/require-staff.ts:87-92`, `src/app/admin/actions.ts:94`, `src/lib/auth/roles.ts:49`
- **Reporters:** SPEC (L), LEAD — 2
- **Disposition:** ACCEPT — `loginDenialReason()` ใน roles.ts เป็น single source (คืนเหตุผลด้วย) ใช้ทั้ง 3 ที่ ทำพร้อม F1/F3

### F16 — legacy dedup dual-compare ไม่มีเงื่อนไข/เครื่องหมายให้ลบ
- **Location:** `src/lib/dedup.ts:25-29`, `src/lib/cid-hmac.ts:74-86`
- **Reporters:** SPEC (L), LEAD — 2
- **Disposition:** ACCEPT — § comment ระบุเงื่อนไขลบที่ตรวจได้ (พ้น 7 วันหลัง deploy production ที่มี #117 + SQL ตรวจว่าไม่มีแถวสูตรเก่าค้าง) ทำพร้อม F6

### F17 — normalize dedup ไม่ตัด zero-width (U+200B-D) / ไม่ NFC
- **Location:** `src/lib/cid-hmac.ts:70`
- **Reporters:** SEC (L), TS (L) — 2
- **Disposition:** **DEFER** — เปลี่ยนสูตร normalize อีกรอบ = hash รุ่นที่ 3 ต้องเพิ่มช่วงเปลี่ยนผ่านซ้อน (แถวที่เขียนด้วยสูตร #117 จะหลุด) ควรทำพร้อมการลบ legacy (F16) ในงานแยก

### F18 — `broadcaster.test.ts` ไม่ hermetic (ยิง Redis จริงผ่าน .env.local)
- **Location:** `src/lib/line/sse/broadcaster.test.ts:1-2`
- **Reporters:** TEST (ใน M) — 1 (LEAD ยืนยัน: ไฟล์ไม่ mock `@/lib/upstash`)
- **Disposition:** ACCEPT — mock `@/lib/upstash` ในไฟล์เดิม ทำพร้อม F5 (pre-existing แต่ไฟล์ test ต้องแตะอยู่แล้ว)

### F19 — close-stale ไม่ export `maxDuration`
- **Location:** `src/app/api/cron/close-stale/route.ts`
- **Reporters:** TS (L) — 1
- **Disposition:** **DEFER** — ค่าขึ้นกับ Vercel plan/fluid compute (ไม่อยู่ใน repo config); batch 100 + `truncated` + warn พอสำหรับระดับ อบต. — บันทึกไว้ให้ตัดสินตอน deploy
