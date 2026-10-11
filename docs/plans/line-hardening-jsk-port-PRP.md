# PRP-Plan: เอาของดี jsk-app LINE เข้า huangua-works (6 tranches)

อ้าง PRD: `docs/plans/line-hardening-jsk-port-PRD.md` · branch: `feat/line-hardening-jsk-port`

## ลำดับ tranche (เล็ก → ใหญ่, ตาม laziness-protocol)

### T1 — rate limit webhook (เล็กสุด, กัน flood ก่อน)

ไฟล์:
- แก้ `src/lib/rate-limit/policies.ts` — เพิ่ม `lineWebhookIp` (kind `public`, fail-open)
- แก้ `src/app/api/line/webhook/route.ts` — เรียก `enforceRateLimit` หลัง verify signature ก่อน dedup; เกิน → 429 + `Retry-After`
- สร้าง `src/app/api/line/webhook/route.test.ts` — mock enforce: false → 429, true → 200

บล็อก: ไม่มี (เริ่มได้เลย)
ทดสอบ: `npx vitest run src/lib/rate-limit src/app/api/line/webhook`
เสี่ยง: E2E ชน limit — ต้องล้าง key `rate:line-webhook:ip:*`

### T2 — circuit breaker LINE client

ไฟล์:
- สร้าง `src/lib/line/circuit-breaker.ts` — `withLineCircuit(endpoint, fn)`, Redis state key `line:circuit:<endpoint>`, threshold 5, open 30s, สำเร็จปิดวงจร
- สร้าง `src/lib/line/circuit-breaker.test.ts` — fail 5 → open fast-fail; ครบ 30s → half-open; สำเร็จ → closed
- แก้ `src/lib/line/client.ts` — ห่อ `postLine` ด้วย breaker (ไม่แตะลายเซ็น export)

บล็อก: T1
ทดสอบ: `npx vitest run src/lib/line/circuit-breaker`
เสี่ยง: Redis ล่ม → fail-open ยิงตรงเหมือนเดิม

### T3 — outbox: commit ก่อน announce

ไฟล์:
- สร้าง `src/lib/line/outbox.ts` — `Outbox` เก็บ closure, `drainOutbox` หลัง commit
- แก้ `src/lib/cases/intake.ts` (`createCase`) — announce เข้า outbox, drain หลัง tx commit
- แก้ `src/lib/line/conversation/message-service.ts` — broadcast/push ผ่าน outbox
- สร้าง `src/lib/line/outbox.test.ts` — commit ล้ม → announce ไม่รัน

บล็อก: T2 (breaker ต้องห่อ push ก่อนย้ายเข้า outbox)
ทดสอบ: `npx vitest run src/lib/line/outbox src/lib/cases/intake`
เสี่ยง: `logAudit` ใน tx อยู่แล้ว — ตรวจไม่ให้ drain ซ้ำ

### T4 — webhook dedup แข็ง

ไฟล์:
- แก้ `src/app/api/line/webhook/route.ts` — lock token uuid + Lua compare-delete release, redelivery dedup `line_message_id` (เก็บ `webhook:msg:<id>`)
- สร้าง/แก้ test เดิม — event ซ้ำ → ครั้งเดียว; Redis ล่ม → fail-open

บล็อก: T1 (อยู่ไฟล์เดียวกัน)
ทดสอบ: `npx vitest run src/app/api/line/webhook`
เสี่ยง: Lua บน up-redis proxy — ใช้ `eval` ตรง ถ้าไม่รองรับ fallback `get`+`del` แบบ best-effort

### T5 — broadcast retry + failed log + dry-run

ไฟล์:
- migration เพิ่มตาราง `broadcast_failed_recipients` (token_hash, error, attempts) ผ่าน `npx drizzle-kit generate`
- แก้ `src/lib/line/broadcast-service.ts` — multicast chunk 500, retry 3, บันทึก failed, `dryRun` คืนจำนวนไม่ส่งจริง
- แก้ `src/app/api/line/admin/broadcasts/route.ts` + `[id]/send/route.ts` — รับ `dryRun` flag
- test: broadcast-service.test.ts — token ล้ม → failed log + retry ครบ

บล็อก: T2+T3 (ใช้ breaker + outbox)
ทดสอบ: `npx vitest run src/lib/line/broadcast-service`
เสี่ยง: schema migration — `npx drizzle-kit push` local ก่อน

### T6 — ownership/claim/ack/queue (ใหญ่สุด)

ไฟล์:
- แก้ `src/lib/line/conversation/mode-service.ts` — claim แบบ conditional (มีผู้ชนะคนเดียว) + owner id
- แก้ `src/lib/line/bot/handoff.ts` — ตอบพร้อม queue position + wait avg (นับ WAITING ข้างหน้า)
- แก้ SSE `src/lib/line/sse/broadcaster.ts` — event `claim_update` + `message_ack`
- แก้ chat UI `src/app/admin/chat/_components/composer.tsx` — ownership gate + takeover banner; `message-list.tsx` — ack state
- test: mode-service claim race, handoff queue, composer gate

บล็อก: T1–T5 (ฐานต้องนิ่งก่อนแตะ UI)
ทดสอบ: `npx vitest run src/app/admin/chat src/lib/line/conversation` + `npx playwright test e2e/chat.spec.ts` (ถ้ามี)
เสี่ยง: contrast gate — สีใหม่เพิ่มคู่ใน `src/lib/design/contrast-pairs.ts`

## Review gate (ก่อนลงมือ T1)

- [ ] PRD ครบ: ปัญหา/ขอบเขต/เกณฑ์/ข้อจำกัด ตรงจินตนาการ
- [ ] PRP file-level ถูก: path มีจริง, ไม่มีชน pattern เดิม
- [ ] ลำดับ T1→T6 ไม่มีวงจรบล็อก
- [ ] สมมติฐาน (Lua บน up-redis, key format, fail-open webhook) ยืนยันแล้ว
