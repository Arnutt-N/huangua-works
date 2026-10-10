---
name: verify
description: ขับแอปจริงของระบบรับเรื่องร้องเรียน อบต.หัวงัว (Next.js 16 + Postgres + Redis, UI ภาษาไทย) เพื่อพิสูจน์ว่า change ใช้ได้จริง — เริ่ม dev stack (Docker), รัน Playwright e2e หรือยิง API, เก็บ screenshot และ evidence. ใช้เมื่อต้องพิสูจน์ว่าฟีเจอร์ทำงานได้ / ก่อน commit / หลังแก้บั๊ก / หลังเปลี่ยน schema หรือ auth flow
---

# verify — ขับแอปจริง อบต.หัวงัว

ระบบรับเรื่องร้องเรียน/ร้องทุกข์แบบ Traffy สำหรับ อบต. มีสาม surface:
**public web** (`/intake`, `/track`), **LINE OA chatbot** (`/api/line/*`),
**admin** (`/admin/*`) — UI และข้อความทั้งหมดเป็นภาษาไทย

## Surfaces

| Surface | วิธีขับ |
|---|---|
| Public web (หลัก) | Playwright e2e ที่มีอยู่แล้วใน `e2e/*.spec.ts` — ครอบ `/intake`, `/track`, geography cascade, LIFF mock |
| Admin web | Playwright (`e2e/admin-auth.spec.ts`, `e2e/admin-chat.spec.ts`) — login แล้วเข้าทุกหน้า `/admin/*` |
| API | `curl` ตรงๆ (`/api/provinces`, `/api/cases/submit`, `/api/cron/ping`) |
| LINE bot | `npx tsx scripts/test-webhook.ts` — ส่ง event ที่มี signature ถูกต้องเข้า webhook จริง |

---

## Launch — เริ่ม dev stack ทั้งก้อน

repo นี้ **รันแค่ `next dev` อย่างเดียวไม่ได้** — ต้องมี Postgres + Redis (up-redis) ก่อน
ไม่มีสองตัวนี้ หน้า public พังหมด (geography โหลดไม่ได้) และ auth พังหมด
(rate limit บาง path ใช้ `failOpen: false`)

```bash
# 1. Docker Desktop ต้องรันอยู่ — ถ้า `docker ps` error ให้เปิด Docker Desktop ก่อน
docker ps

# 2. เอา Postgres + Redis + up-redis ขึ้น (map port 5433 และ 8081 ออก host)
docker compose up -d postgres redis up-redis

# 3. push schema (idempotent) + seed ข้อมูล baseline
npx drizzle-kit push && npx tsx scripts/seed.ts

# 4. dev server บน host — log ไว้ที่ /tmp/dev-server.log
npx next dev > /tmp/dev-server.log 2>&1
```

**พร้อมขับเมื่อ:** `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` ตอบ `200`
(ครั้งแรก compile ช้า 4-40s, log จะมีบรรทัด `✓ Ready in ...`)

### Teardown

```bash
kill %1                        # dev server ที่ตัวเองเปิด — ห้าม kill by name
docker compose down            # container หยุด, volume postgres-data ยังอยู่ (DB ไม่หาย)
```

**§ ถ้า `docker compose down` แล้ว port 3000 ยัง LISTENING** — Playwright `webServer`
(`reuseExistingServer: true`) สปอน dev server เองตอนรัน e2e และไม่ฆ่าตอนจบ
หาอỘเจ้าของ port แล้ว kill by PID เท่านั้น อย่า kill by process name:

```bash
netstat -ano | grep LISTENING | grep ':3000\b'   # เอาคอลลี่สุดท้าย = PID
```

---

## Doctor — instance นี้ขับคุ้มไหม

รันก่อนทุกครั้งเมื่ออะไรดูแปลก หรือหลัง drive ล้มเหลว:

```bash
# 1. Docker daemon รันอยู่?
docker ps --format '{{.Names}}' | grep -E 'huangua-postgres|up-redis'

# 2. port ที่ต้องใช้อยู่ในสถานะ LISTENING (3000 app, 5433 postgres, 8081 up-redis)
netstat -ano | grep LISTENING | grep -E ':(3000|5433|8081)\b'

# 3. routes ตอบ 200 หรือไม่ (public 3 หน้า + admin login + หนึ่ง API)
for p in / /intake /track /admin/login /api/provinces; do
  printf '%s -> %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000$p)"
done

# 4. DB มีข้อมูลพื้นฐานไหม (geography ว่าง = ฟอร์ม intake ส่งไม่ได้เลย)
npx tsx -e "
import{config}from'dotenv';config({path:'.env.local'});
import{sql}from'drizzle-orm';import{getDb,closeDb}from'./src/lib/db';
import{provinces,villages,categories}from'./src/lib/db/schema';
const db=await getDb();
for(const[n,t]of Object.entries({provinces,villages,categories}))
  console.log(n,(await db.select({c:sql\`count(*)::int\`}).from(t))[0].c);
await closeDb();"
# ค่าที่คาด: provinces = 77, villages = 80396, categories = 13
```

**เจอสัญญาณเหล่านี้:** `docker ps` ล้มเหลว → Docker Desktop ไม่ได้เปิด ·
port 5433/8081 ว่าง → container หยุด · `provinces = 0` → รัน `npx tsx scripts/seed-villages.ts`

---

## Drive

**เครื่องเดียวขับได้ทีละ spec** — e2e ทั้งหมดแชร์ Postgres:5433 + Redis:8081 ตัวเดียวกัน
จึงตั้ง `fullyParallel: false, workers: 1` ไว้ใน `playwright.config.ts` อยู่แล้ว
ถ้าขับเองด้วยมือ จำไว่ว่า spec แต่ละตัว reset rate-limit และลบ row ที่สร้างเองใน `afterAll`

### E2E (proof ที่แข็งแรงสุด)

```bash
npx playwright test                                     # ทั้งหมด — playwright จะสตาร์ dev server ถ้ายังไม่อยู่
npx playwright test e2e/intake.spec.ts                  # เดี่ยว
npx playwright test e2e/admin-auth.spec.ts
```

**LIFF specs ต้องตั้ง env เพิ่ม** (default skip ไปเลย):

```bash
LIFF_E2E_MOCK=1 npx playwright test e2e/intake-liff.spec.ts e2e/track-liff.spec.ts
```

### API เดี่ยวๆ

```bash
curl -s 'http://localhost:3000/api/provinces' | head -c 200; echo
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/cron/ping          # 401 = ปกป้องถูก
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/ping  # 200 = secret ตรง
```

### LINE bot (webhook + bot engine จริง)

```bash
npx tsx scripts/test-webhook.ts http://localhost:3000 follow    # welcome reply
npx tsx scripts/test-webhook.ts http://localhost:3000 message   # "แจ้งเรื่อง" → FAQ/intent
npx tsx scripts/test-webhook.ts http://localhost:3000 handoff   # "ติดต่อเจ้าหน้าที่" → waiting_handoff
```

**§ argv ของ script นี้คือ BASE ก่อน event เสมอ** (`scripts/test-webhook.ts:21-22`) —
`argv[2]` = BASE, `argv[3]` = event type. default ของ script คือ `http://localhost:3001`
ซึ่งไม่มีอะไรรันอยู่ เลยต้องส่ง BASE `http://localhost:3000` ทุกครั้ง ไม่งั้นได้
TypeError จาก invalid URL ที่แสดงข้อความ "ไม่สามารถเชื่อมต่อ" (หลอกว่า server ล้ม)

---

## Evidence

เก็บไว้ที่ **`.verify-evidence/`** (gitignored) ตั้งชื่อโฟลเดอร์ `YYYYMMDD-HHMMSS-<context>/`

| ขันอะไร | เก็บยังไง |
|---|---|
| UI flow | Playwright trace + screenshot (`--trace on --screenshot on`) และ `--reporter=html` → `playwright-report/` |
| API | response body + HTTP status (`curl -s -w '\n%{http_code}'`) |
| LINE bot | stdout ของ `test-webhook.ts` + row ที่พึ่งสร้างใน `conversations` / `line_users` |
| Console error | Playwright listener บน `pageerror` — มีแบบใน `e2e/admin-chat.spec.ts` |

**Proof standards (บังคับ):**

1. **ยืนยัน user path จริง** — ต้องผ่าน UI/CLI เหมือนผู้ใช้ทำ ไม่ยิง internal setter หรือ test-only endpoint
2. **เก็บทั้ง action และ resulting state** — กด "ส่งเรื่อง" ต้องเห็นหน้าเรียบร้อย **และ** เห็นแถวใน DB (`cases` มี `trackingCode` รูปแบบ `HG…`)
3. **ยืนยัน side effects** — ไฟล์/แถว/message ที่สร้างขึ้นต้องเจอ ไม่ใช่แค่ final screen (เช่น consent row, audit row)
4. **mock ขอเขตที่ production boundary แยกอยู่แล้ว** — LIFF ใช้ `LIFF_E2E_MOCK=1` เพราะ LINE เป็น third-party ที่ยืนยันตัวตนต่างหาก
5. **dry-run ที่ชื่อว่าปลอดภัยต้องพิสูจน์ด้วยการสังเกต** — อย่าเชื่อชื่อ ดูของจริง (file, network, git ref)

```bash
D=$(date +%Y%m%d-%H%M%S)-<context>; mkdir -p .verify-evidence/$D
npx playwright test e2e/intake.spec.ts --trace on --screenshot on --reporter=html
cp -r playwright-report/ .verify-evidence/$D/
```

---

## Cleanup

```bash
kill %1                        # dev server ที่ตัวเองเปิด
docker compose down            # container หยุด, DB data ยังอยู่
```

- e2e spec แต่ละตัวลบ test row เองใน `afterAll` — ไม่ต้องทำมือ ถ้าค้าง ดูที่ email `@placeholder.local` หรือ tracking code `HN…`/`HG…`
- **อย่าลบ `.verify-evidence/`** — evidence ต้องอยู่หลัง teardown (คือจุดสำคัญของการเก็บหลักฐาน)

---

## Helpers

| ไฟล์ | ทำไร | invoke |
|---|---|---|
| `e2e/helpers/geography.ts` | `loadFirstGeography()` + `fillGeographyCascade(page, geo)` — cascade จังหวัด/อำเภอ/ตำบล โดยหยิบชื่อจาก DB แถวแรก | import ใน spec ใหม่ |
| `e2e/helpers/reset-rate-limits.ts` | `resetRateLimits(rateLimitKey('submit','::1'))` — ล้าง rate-limit ก่อน drive มือ เก้ณฑ์ 429 | import หรือยิง Redis `DEL` ตรงๆ |
| `scripts/test-webhook.ts` | LINE webhook end-to-end จาก shell | `npx tsx scripts/test-webhook.ts http://localhost:3000 <follow\|message\|handoff>` (BASE มาก่อน event เสมอ) |
| `.claude/skills/verify/features/` | feature map — หน้าจอไหนขับยังไง, observable end state คือไร | อ่านก่อนเลือก feature ที่จะพิสูจน์ |

อ่าน `features/README.md` **ก่อนทุกรัน** — proof ที่ขับ entry point หน่วยเดียวไม่พอถ้า map มีหลาย entry
