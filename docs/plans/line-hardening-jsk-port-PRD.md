# PRD: เอาของดี jsk-app LINE เข้า huangua-works (6 tranches)

## ปัญหา

ระบบ LINE ของ huangua-works มีช่องโหว่และความสามารถขาดเมื่อเทียบกับ jsk-app (`D:\genAI\jsk-app`):

1. `POST /api/line/webhook` ไม่มี rate limit — flood จาก user เดียวยิง DB/LINE ได้ไม่จำกัด ทั้งที่ `checkRateLimit` มีแล้วใน `src/lib/upstash.ts` แต่ไม่มี caller ที่ webhook (`src/app/api/line/webhook/route.ts`)
2. `src/lib/line/client.ts` เรียก LINE API ตรง (`postLine`) ไม่มี circuit breaker — LINE ล่มลามทั้ง webhook (jsk-app มี `_call_with_circuit`: ล้ม 5 ครั้ง open 30s)
3. ไม่มี outbox — commit ก่อนหรือ announce ก่อนไม่ชัด เสี่ยง ghost/ซ้ำ (jsk-app มี `services/outbox.py`)
4. dedup อ่อน — มีแค่ `redis.set(nx, ex 300)` ไม่มี uuid lock token + Lua release + redelivery dedup `line_message_id`
5. broadcast ไม่มี retry/failed-recipient log/dry-run (`src/lib/line/broadcast-service.ts` มีแค่ service)
6. live chat ไม่มี ownership/claim lock/ack/queue (`src/lib/line/bot/handoff.ts` คืนแค่ boolean, SSE มีแค่ fan-out)

## ขอบเขต

**ในขอบเขต:** T1 rate limit webhook · T2 circuit breaker LINE client · T3 outbox (intake + message-service) · T4 webhook dedup แข็ง · T5 broadcast retry + failed log + dry-run · T6 ownership/claim/ack/queue + handoff wait info

**นอกขอบเขต:** permission matrix DB-backed · Telegram/n8n integration · SLA/CSAT · LIFF intake ใหม่ · Fernet pseudonymization (HMAC CID เดิมพอ) · rich-menu scheduler/alias/insights (รอบถัดไป)

## เกณฑ์ยอมรับ (ตรวจได้)

- T1: flood เกิน policy ที่ webhook ถูกปฏิเสธด้วย 429 + `Retry-After`; Redis ล่มยังรับ webhook ได้ (fail-open, kind `public`)
- T2: LINE API ล้มติดกันครบ threshold → fast-fail ทันทีไม่ยิงจริง; ครบ cooldown กลับมาปิดวงจรเมื่อสำเร็จ
- T3: DB commit ล้ม → ไม่มี announce/notify หลุดออกไป; commit สำเร็จ → announce ครบ
- T4: ส่ง event เดิมซ้ำ → ประมวลผลครั้งเดียว; Redis ล่ม → fail-open ประมวลผลต่อ
- T5: broadcast บาง token ล้ม → มี failed log + retry ครบ 3 ครั้ง; dry-run คืนจำนวนผู้รับโดยไม่ส่งจริง
- T6: 2 operator claim ห้องเดียว → มีผู้ชนะคนเดียว อีกคนเห็น lock + ชื่อเจ้าของ; ส่งข้อความมี ack/fail/retry; handoff ตอบพร้อมข้อมูลรอคิว

## ข้อจำกัด

- `AGENTS.md`: branch ใหม่, TDD red→green→refactor, lint + typecheck + test หลังแต่ละ unit, conventional commits, local gates ก่อน PR
- `pnpm` ค้างใน env นี้ — ใช้ `npx` แทน (`npx tsc --noEmit`, `npx eslint .`, `npx vitest run`)
- นโยบาย rate limit ใหม่ต้องเป็น kind `public` (fail-open) — webhook คือบริการประชาชน ห้ามล่มตาม Redis (ดู `src/lib/rate-limit/policies.ts`)
- key format `rate:<scope>:<subject>` คงเดิมทุก byte (production นับต่อได้)
- สี/class ใหม่ใน chat UI ต้องเพิ่มคู่ใน `src/lib/design/contrast-pairs.ts` (contrast gate)
- E2E `fullyParallel: false, workers: 1` — ห้ามขนานเพราะชน rate-limit/dedup state

## ตัวชี้วัด

- webhook รับ flood เกิน limit แล้วคืน 429 (test ระดับ unit + integration)
- LINE ล่มจำลอง → webhook ไม่ค้าง/retry loop (breaker open)
- ทุก tranche: `npx tsc --noEmit` + `npx eslint .` + `npx vitest run` เขียว
