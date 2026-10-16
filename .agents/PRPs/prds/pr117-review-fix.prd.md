# PRD — แก้ findings จากการรีวิว PR #117

- Source spec (binding): `.agents/PRPs/findings/pr117-findings.md`
- Branch: `fix/pr117-review-findings`
- Skills: karpathy-guidelines (baseline) · superpowers (TDD, verification-before-completion) · ecc (PRP + security-review)

## Problem statement

PR #117 ประกาศปิด 5 HIGH + 6 MEDIUM/LOW แต่การรีวิวอิสระ 4 มุม (security, correctness, tests, spec) พบว่า:

1. **ข้อแก้ความปลอดภัยบางข้อไม่ได้เกิดขึ้นจริง** — tier fail-closed (F1) เปลี่ยนแค่ comment; SSE reconnect (F5) ไม่ครอบคลุมกรณี stream ขาดเงียบ ซึ่งเป็นกรณีหลัก
2. **ช่องโหว่ที่ PR ระบุเองยังเปิดอยู่ครึ่งหนึ่ง** — ยิง credentials callback ตรงข้าม rate limit ได้ (F2)
3. **PR สร้าง regression** — บัญชีระงับเห็น "รหัสผ่านไม่ถูกต้อง" และ audit ปนกับ brute-force metric (F3)
4. **§ comment และ AGENTS.md ผิดจากโค้ด** หลายจุด (F4, F8, F12, F13) — repo นี้ใช้ § comment และ AGENTS.md เป็นเอกสารที่ agent ทุกตัวเชื่อ ข้อความผิดจึงชวนให้ "แก้กลับ" สิ่งที่ถูก
5. **test ไม่ล็อกพฤติกรรมที่อ้าง** — มี tautology (F6) และเส้นทาง security หลายจุดไม่มี test เลย (F1, F3, F8-F11)

## ต่อ finding: root cause · impact · ทำไมต้องแก้ตอนนี้

| ID | Sev | Root cause | Impact | ทำไมตอนนี้ |
|---|---|---|---|---|
| F1 | High | `allowedRoles` ที่ catch คืน = compiled default (ไม่ใช่ whitelist แคบ) และ `loadTierMap` กลืน error แล้ว cache default 60 วิ | ระหว่าง DB สะดุด tier ที่แอดมินตั้งแคบจะกว้างกลับเงียบ ๆ — สิทธิ์ขยายโดยไม่มีใครเห็น | PR ประกาศว่าปิดแล้ว ทีมจะไม่กลับมาดูอีก |
| F2 | High | rate limit อยู่ที่ server action แต่ Auth.js HTTP callback เปิดรับตรง | brute-force รหัส staff ไม่จำกัด | เป็น threat path ที่ PR ยกเองแต่ปิดแค่ผลข้างเคียง |
| F3 | Med | authorize คืน null ไม่มีช่องส่งเหตุผล | UX หลอก (ผู้ใช้ไป reset รหัสผิดทาง) + SIEM นับ suspended-login เป็น brute force | regression จาก PR ล่าสุด แก้ง่ายตอนบริบทยังสด |
| F4 | Med | PR เปลี่ยนพฤติกรรมแต่ไม่อัปเดตเอกสาร | agent ถัดไปอาจ revert fix ตาม AGENTS.md | AGENTS.md เป็น source of truth ของ agent ทุกตัว |
| F5 | Med | Upstash Subscriber ไม่ emit `'error'` ตอน stream ขาด + reconnect แบบ lazy | แชทแอดมินพลาดข้อความ LINE แบบ real-time เงียบ ๆ | PR ประกาศว่าแก้แล้ว |
| F6 | Med | test สร้าง array ที่มีค่าที่ assert อยู่แล้ว | เส้นทาง legacy dedup ไม่มีอะไรคุ้มครอง | ช่วงเปลี่ยนผ่าน 7 วันคือช่วงที่โค้ดนี้มีผลจริง |
| F8 | Med | comment เขียนจากความเข้าใจผิดเรื่องโค้ดเก่า | ผู้อ่านเชื่อว่า prod เคย hash ด้วย key ว่าง | comment ผิดคือหนี้ที่โตขึ้น |
| F9 | Med | limit ไม่มี order, คำนวณ truncated แบบ `>=` | เลือกแถวไม่แน่นอน, flag หลอก, backlog เงียบ | เพิ่งเพิ่มใน PR นี้ |
| F10 | Med | ด่าน input วางท้าย + guard ซ้ำ | query เปล่า 3-7 รอบต่อ input ผิด, dead code, PDPA fix ไม่มี test | เพิ่งเพิ่มใน PR นี้ |
| F11 | Med | ไม่มี test file | revert `<=`→`<` ได้โดยไม่มีอะไรแดง | gate หมดอายุ session |
| F12 | Med | comment อ้างพฤติกรรม LINE ผิด + dedup อยู่นอก try | event ผิดรูปทำทั้ง batch 500 | เพิ่งแก้ในไฟล์นี้ |
| F13 | Med | เปลี่ยนจาก compare string เป็น decode แบบหลวม | รับ signature encoding ไม่ canonical (ไม่ forge ได้ แต่ malleable) + comment กลับด้าน | ด่าน auth ของ webhook |
| F14 | Low | ถอด setMaxListeners ด้วย premise ผิด | warn หลอกเมื่อ staff เปิดแชทพร้อมกัน >10 | แตะไฟล์เดียวกับ F5 |
| F15 | Low | helper ใหม่ไม่ถูกใช้ | กฎ eligibility 3 ชุด drift ได้ | แตะไฟล์เดียวกับ F1/F3 |
| F16 | Low | ไม่มีเงื่อนไขลบ | dead code ถาวร | แตะไฟล์เดียวกับ F6 |
| F18 | Low | test ไม่ mock Redis | test ช้า/ไม่ hermetic | แตะไฟล์เดียวกับ F5 |

## Scope

**In:** F1-F6, F8-F16, F18, F20 ตาม disposition ใน findings file (F20 พบระหว่าง plan gate รอบ 1)

**Out (deferred, เหตุผลใน findings):** F17 (normalize zero-width/NFC — ต้องมี hash รุ่นที่ 3), F19 (maxDuration — ขึ้นกับ Vercel plan)

**Out (ไม่ทำ):** refactor อื่นที่ไม่มีใน findings · เปลี่ยน shared `createVersionedCache` · เปลี่ยน UX หน้า login · แก้ test flaky เดิม 3 ไฟล์ใน baseline

## Acceptance criteria (ตรวจได้)

1. tier matrix อ่านไม่ได้ (error ที่ไม่ใช่ `42P01`) → `requireStaffApi(STAFF_ROLES)` ของ `officer` ได้ 403, ของ `superadmin` ได้ ok — มี test
2. ตาราง `tier_roles` ไม่มี (`42P01`) → ได้ default เดิม — มี test
3. `POST /api/auth/callback/credentials` (รวม trailing slash / double slash) → 404 และไม่เรียก Auth.js; path อื่นผ่าน — มี test
4. login ด้วยรหัสถูกของบัญชีระงับ → 'บัญชีนี้ถูกระงับการใช้งาน' + `ACCESS_DENIED {reason:'inactive'}`; citizen → 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานส่วนเจ้าหน้าที่' + `reason:'citizen_role'`; รหัสผิด → ข้อความเดิม + `LOGIN_FAILURE` — มี test
5. authorize (หลัง extract) คืน user เมื่อ staff active รหัสถูก, throw `IneligibleAccountSignin` เมื่อ citizen/inactive, คืน null เมื่อรหัสผิด/ไม่มี user — มี test
6. AGENTS.md, auth.ts, actions.ts, proxy.ts, tiers.ts ไม่มีข้อความขัดกับพฤติกรรม (grep ตาม Validation)
7. broadcaster: subscriber error หรือ loopback เงียบเกิน `STALE_AFTER_MS` → unsubscribe ตัวเก่า + subscribe ใหม่ภายใน 1 heartbeat โดยไม่ต้องมี client ใหม่; ข้อความจาก subscriber เก่าไม่ถูกส่งซ้ำ; ping ไม่ถึง listener; ไม่มี listener → หยุด subscriber + watchdog — มี test (fake timers)
8. `checkDuplicate` จับแถว hash สูตรเก่า (ยังไม่หมดอายุ) ได้ และไม่จับแถวหมดอายุ — integration test
9. tautology ใน cid-hmac.test.ts ถูกลบ; test "key เปลี่ยนหลัง import → hash เปลี่ยน" ผ่าน
10. close-stale: 101 แถว → ประมวลผล 100, `truncated:true`; 100 แถว → `truncated:false`; query มี orderBy — unit test
11. createCase ไม่มี identity → `internal` โดยไม่แตะ DB; `cases.metadata` ไม่มี ipAddress/userAgent — unit test
12. `isTokenExpired` ขอบ T-1/T/T+1/undefined — unit test
13. webhook: `events:[null, validEvent]` → 200 และ validEvent ถูกประมวลผล; message event ไม่มี `message` → 200 — test
14. signature: unpadded / url-safe / มี whitespace / malformed → `false`; ค่าถูก → `true` — test
16. login request ที่มี header `x-auth-return-redirect` → 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' + `LOGIN_FAILURE`, `signIn` ไม่ถูกเรียก — มี test
15. Gates: `npx tsc --noEmit` เขียว · `npx eslint .` เขียว · `npx vitest run` ไม่มี failure ใหม่เมื่อเทียบ baseline (flaky timeout เดิม 3 ไฟล์ต้องผ่านเมื่อรันเดี่ยว)

## Constraints & dependencies

- `pnpm` ค้างในเครื่องนี้ → ใช้ `npx`
- integration test ต้องมี Docker (Postgres :5433, up-redis :8080) — ขึ้นแล้ว
- Next.js 16 (`proxy.ts`), Auth.js v5 beta.32 (`@auth/core` 0.41.3), drizzle-orm 0.45 (error ห่อใน `DrizzleQueryError.cause`), @upstash/redis 1.38.0
- GitHub Actions ปิดอยู่โดยตั้งใจ — gate จริงคือ local + Vercel preview
- โปรเจกต์อยู่ช่วงทดสอบ ไม่มี prod data (memory) — legacy dedup path มีผลเฉพาะ deploy ที่มีข้อมูลจริง

## Success metrics

- High ที่ยังเปิด = 0 (G3)
- ทุก finding ที่ ACCEPT มี test ที่แดงก่อนแก้ (หรือพิสูจน์ได้ว่าแดงถ้า revert) และเขียวหลังแก้
- ไม่มี failure ใหม่ใน full suite เทียบ baseline 1090/1094
