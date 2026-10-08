# Bot Configuration Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้ `bot_enabled` และ `business_hours` ที่ admin บันทึกมีผลกับบอท LINE จริง และให้ค่าบอท/intents ที่เขียนจากหน้า admin ไปถึง process ของ webhook ภายในไม่กี่วินาที โดยผู้เขียนไม่ต้องจำเรียก invalidate เอง

**Architecture:** แยก logic เวลาทำการเป็น pure module (`business-hours.ts`) ที่ inject `now` ได้ แล้วให้ `engine.ts` อ่าน `bot_enabled` ก่อนส่งต่อให้บอท และอ่าน `business_hours` ตรงทางแยก handoff ส่วน cache ของ `settings.ts` กับ `intent-matcher.ts` เปลี่ยนไปใช้ `createVersionedCache()` ตัวเดียวกัน ซึ่งเทียบเลข version ใน Redis (`INCR` ตอนเขียน) ทุก 3 วินาที และยังมี TTL 60 วินาทีเป็น fallback ตอน Redis ล่ม การเขียน intents ย้ายไป `intent-store.ts` ที่ทำงานใน transaction และ bump version ให้เอง

**Tech Stack:** Next.js 16 (route handlers, `runtime = 'nodejs'`), Drizzle ORM 0.45 + postgres-js, `@upstash/redis` 1.38 (REST; local ใช้ up-redis proxy), zod 4, Vitest 3

**Spec:** การ์ด `id="c5"` ใน `project-log-md/architecture-review/2026-10-03/architecture-review-20261003-205746.html` (5 · Bot configuration module) + การตัดสินใจของผู้ใช้ที่ยืนยันวันที่ 2026-10-03: **"ทำให้มีผลจริง"** กลไกที่แผนนี้เลือก (ไม่ใช่ข้อความในการ์ด): `bot_enabled=false` → `waiting_handoff` + `unreadAdmin+1` + ข้อความแจ้งครั้งเดียว; นอกเวลาทำการตอบข้อความนอกเวลาแต่ไม่เข้าคิว handoff

## Global Constraints

- ใช้ `npx` แทน `pnpm` ทุกคำสั่ง (`pnpm` ค้างใน environment นี้)
- comment และข้อความที่ผู้ใช้เห็นเป็นภาษาไทย; comment ที่อธิบายเหตุผลที่ไม่ชัดเจนขึ้นต้นด้วย `§`; **ห้ามลบ `§` เดิม**
- `getDb()` ต้อง `await` ภายในฟังก์ชันเท่านั้น ห้ามเรียกที่ module scope
- ID มาจาก `generateId()` (`src/lib/id.ts`) เท่านั้น
- Integration test (`*.integration.test.ts`) ต้องมี `docker compose up -d postgres redis up-redis` (Postgres `:5433`, up-redis REST `http://localhost:8081` ตาม `.env.local`) — โหลด env ผ่าน `vitest.setup.ts`
- เลขวันใน `business_hours.days` ใช้เลขแบบ JS `Date#getDay()`: `0 = อาทิตย์ … 6 = เสาร์` (ยืนยันแล้วจาก `DAY_LABELS = ['อา','จ','อ','พ','พฤ','ศ','ส']` ใน `settings-client.tsx:17` ที่ `toggleDay(i)` ใช้ index ตรง ๆ และ default `[1,2,3,4,5]` = จันทร์–ศุกร์)
- เวลาทำการประเมินเป็นเวลา `Asia/Bangkok` (UTC+07:00 คงที่ ไม่มี DST) โดยไม่ขึ้นกับ TZ ของ process
- GitHub Actions ปิดอยู่โดยตั้งใจ — gate จริงคือ `npx tsc --noEmit` + `npx eslint` เฉพาะไฟล์ที่แผนนี้แตะ (ต้อง 0 error) + `npx vitest run` + Vercel preview ห้ามอ้าง `npx eslint .` exit 0: baseline ของ repo มี 21 errors / 3 warnings ที่ไม่เกี่ยวกับแผนนี้ ไม่ต้องแก้ในงานนี้ และห้ามเปลี่ยน gate เป็น ignore failures
- **ลำดับกับ plan `conversation-module` (c4) — c5 ทำหลัง c4 เสมอ:** ทั้งคู่แก้ `src/lib/line/bot/engine.ts` และ `engine.test.ts` คนละความหมาย (c4 inject `LineTransport` + `recordInboundMessage`/`recordBotReplies`/`changeMode`; c5 เพิ่ม `now` ให้ `routeBotMessage` และเช็ก `bot_enabled`) ก่อน Task 2 ให้ rebase บน c4 แล้วเขียน step ใหม่จากไฟล์จริง ห้าม apply snippet ในแผนนี้ทับฟังก์ชันที่ c4 เขียนใหม่ bot-disabled ต้องเรียก `changeMode` ของ c4 ไม่ใช่ `UPDATE` mode ตรง และตอบ notice เฉพาะเมื่อ `changeMode` เปลี่ยนโหมดสำเร็จ (กัน notice ซ้ำเมื่อสอง event ชนกัน)
- **ชนกับ plan `admin-resource-hook` (c3) ที่ `src/app/admin/settings/settings-client.tsx`:** c3 แทน import block ทั้งก้อน ต้องคง `BUSINESS_DAY_LABELS` ที่ Task 6 เพิ่ม และคง `toggleDay` / type ของ `business_hours` ห้ามให้ฝั่งใดฝั่งหนึ่งทับอีกฝั่ง
- **ชนกับ plan `parsebody-adoption` (c8) ที่ `src/app/api/line/admin/settings/route.ts`:** ต้องคง schema เข้มของ c5 (`CLOCK_PATTERN`, `start < end`, dedupe `days`) + `parseBody` ของ c8 + `setChatSettings` ถ้า c8 merge ก่อน ห้าม revert กลับไป `request.json()` + `safeParse` เอง
- commit แบบ conventional commits, `git add` ระบุไฟล์ทีละไฟล์ ห้าม `git add -A`; ไม่ใส่ attribution trailer (ผู้ใช้ปิดไว้ global)
- Skills ที่ใช้: karpathy-guidelines (baseline), superpowers (TDD + verification)

---

## การตัดสินใจเชิงพฤติกรรม (อ่านก่อนเริ่ม)

### 1. `bot_enabled = false`

ตรวจที่ `handleMessageEvent()` ใน `src/lib/line/bot/engine.ts` **ก่อน** อัปเดต conversation และ broadcast — ต้องรู้ค่า `bot_enabled` ก่อนคำนวณ `unreadAdmin` (โค้ด Task 2 อ่านก่อน ไม่ใช่หลัง broadcast) ข้อความผู้ใช้ยังถูกบันทึกและ broadcast เหมือนเดิม แล้วจึงแยกทาง **ก่อน** `sendTypingIndicator` / `routeBotMessage`

- ถ้า `mode` เป็น `human_active` / `waiting_handoff` อยู่แล้ว → เหมือนเดิม (เงียบ, `unreadAdmin + 1`)
- ถ้า `mode` เป็น `bot_active` / `resolved` และบอทปิด →
  1. `unreadAdmin + 1` (เดิมจะ reset เป็น 0 เพราะคิดว่าบอทตอบแล้ว)
  2. เปลี่ยน `mode` เป็น `waiting_handoff` + broadcast `mode_change` (`chat-client.tsx:83` ฟัง event นี้อยู่แล้ว)
  3. ตอบกลับ **ครั้งเดียว** ด้วยข้อความแจ้งว่าระบบตอบอัตโนมัติปิดชั่วคราวและส่งเรื่องถึงเจ้าหน้าที่แล้ว (บันทึกเป็นข้อความ `sender: 'bot'` ด้วย)
  4. ข้อความถัดไปจะเงียบเพราะ `mode` เป็น `waiting_handoff` แล้ว — ไม่สแปมผู้ใช้

เหตุผลที่ไม่เลือก "เงียบเฉย ๆ": ห้องที่ยังเป็น `bot_active` มี `unreadAdmin = 0` จึงไม่โผล่ในคิวของเจ้าหน้าที่ ประชาชนจะพิมพ์ไปแล้วไม่มีใครเห็นเลย การย้ายเข้า `waiting_handoff` ใช้กลไกคิวที่มีอยู่แล้วโดยไม่ต้องเพิ่ม state ใหม่

ขอบเขตที่ **ไม่** เปลี่ยน: follow event ยังส่ง `welcome_message` (เป็นคำทักทายที่ admin ตั้งเอง ไม่ใช่บทสนทนาของบอท), postback ไม่ตอบอยู่แล้ว, `botState` ของ case-flow ที่ค้างอยู่ไม่ถูกล้าง (ถ้าเปิดบอทกลับมาแล้วเจ้าหน้าที่ปิดห้องเป็น `resolved` ผู้ใช้จะทำต่อจากขั้นเดิมได้)

### 2. นอกเวลาทำการ

ตรวจที่ทางแยก handoff ใน `routeBotMessage()` (หลัง FAQ, ตรง `if (await isHandoffRequest(text))`) เท่านั้น — บอทยังตอบ FAQ / intents / แจ้งเรื่อง / ติดตามสถานะได้ตลอด 24 ชม.

- ในเวลาทำการ → `triggerHandoff()` เหมือนเดิม
- นอกเวลาทำการ → ตอบข้อความ "ขณะนี้อยู่นอกเวลาทำการ (วัน จ, อ, พ, พฤ, ศ เวลา 08:30–16:30 น.) …" พร้อมแนะนำคำสั่งที่บอทยังทำได้ และ **ไม่** เปลี่ยน `mode`

เหตุผล: ถ้าเปลี่ยนเป็น `waiting_handoff` นอกเวลา บอทจะเงียบทั้งคืน (แม้ผู้ใช้จะพิมพ์ "ติดตาม HG…" ก็ไม่ตอบ) จนเจ้าหน้าที่เข้างานเช้า — แย่กว่าบอกตรง ๆ ว่านอกเวลาและให้ใช้บริการอัตโนมัติไปก่อน

รายละเอียดการประเมิน (pure function `isWithinBusinessHours(hours, now)`):
- `start` รวมนาทีนั้น, `end` ไม่รวม (`08:30 ≤ t < 16:30`); `'24:00'` = สิ้นวัน
- วันใช้ "วันตามเวลาไทย" ไม่ใช่วันตาม UTC (เช่น `2026-10-04T17:30Z` = จันทร์ 00:30 ที่ไทย)
- ค่าเสีย (jsonb ผิดรูป, `start >= end`, เวลาไม่ใช่ `HH:MM`) → ถือว่า **อยู่ในเวลาทำการ** (fail-open = คงพฤติกรรมเดิมที่ handoff ได้เสมอ) ส่วนฝั่งบันทึก zod จะปฏิเสธ `start >= end` ตั้งแต่ต้น
- `days: []` เป็นค่าที่ถูกต้อง = ปิดทุกวัน (admin ตั้งใจ)

### 3. Cache ข้าม process

`createVersionedCache({ load, readVersion, ttlMs: 60_000, versionCheckMs: 3_000 })`:
- โหลดครั้งแรก: อ่าน version จาก Redis ก่อน แล้วค่อย `load()` (ถ้ามีคนเขียนแทรกระหว่างนั้น version ที่เก็บจะเก่ากว่า → รอบถัดไปโหลดใหม่ ไม่พลาด)
- ภายใน 3 วินาทีหลังเช็คล่าสุด → ตอบจาก memory ไม่แตะ Redis (ไม่เพิ่ม latency ต่อข้อความ)
- ครบ 3 วินาที → `GET bot-config:version:<scope>`; ถ้าต่างจากที่เก็บไว้ → โหลดใหม่
- Redis ล่ม / timeout 500ms / ไม่มี env Upstash → `null` → ใช้ค่าเดิมจนครบ TTL 60 วินาที (พฤติกรรมเดิม)
- ผู้เขียน (`setChatSettings`, `createIntent`/`updateIntent`/`deleteIntent`) เขียน DB เสร็จ → `invalidate()` cache ของ process ตัวเอง → `INCR` version ใน Redis — **route ไม่ต้องเรียกอะไรเพิ่ม**

`bot_engine_v2` ยังแก้จากหน้า admin ไม่ได้ — อยู่นอกขอบเขตของการตัดสินใจครั้งนี้ (ไม่แตะ)

---

## File Structure

| ไฟล์ | สถานะ | หน้าที่ |
|---|---|---|
| `src/lib/line/business-hours.ts` | Create | pure: parse เวลา, เวลาไทย, `isWithinBusinessHours`, ข้อความนอกเวลา, ป้ายชื่อวัน |
| `src/lib/line/business-hours.test.ts` | Create | unit test |
| `src/lib/line/bot/engine.ts` | Modify `:101-170`, `:172-178`, `:242-244` | ตรวจ `bot_enabled` + เวลาทำการ |
| `src/lib/line/bot/engine.config.test.ts` | Create | unit test พฤติกรรมใหม่ของ engine |
| `src/lib/line/bot/engine.test.ts` | Modify `:24-32` | เติม `business_hours` ใน mock |
| `src/lib/line/versioned-cache.ts` | Create | cache ที่เทียบ version + TTL fallback (pure, inject deps) |
| `src/lib/line/versioned-cache.test.ts` | Create | unit test |
| `src/lib/line/config-version.ts` | Create | อ่าน/INCR เลข version ใน Redis |
| `src/lib/line/config-version.test.ts` | Create | unit test (mock redis) |
| `src/lib/line/config-version.integration.test.ts` | Create | Redis จริง |
| `src/lib/line/settings.ts` | Rewrite | ใช้ versioned cache, `setChatSettings` ใน transaction, ลบ `setChatSetting`/`invalidateSettingsCache` |
| `src/lib/line/settings.integration.test.ts` | Create | Postgres + Redis จริง: module + จำลอง "อีก process" + route GET/PUT (ไฟล์เดียว — ดูเหตุผลใน Task 5) |
| `src/app/api/line/admin/settings/route.ts` | Modify | zod เข้มขึ้น + ใช้ `setChatSettings` |
| `src/app/admin/settings/settings-client.tsx` | Modify `:17` | ใช้ `BUSINESS_DAY_LABELS` ชุดเดียวกับบอท |
| `src/lib/line/bot/intent-matcher.ts` | Modify `:1-4`, `:46-74`, `:87` | ใช้ versioned cache |
| `src/lib/line/bot/intent-store.ts` | Create | create/update/delete intent ใน transaction + publish change |
| `src/lib/line/bot/intent-store.integration.test.ts` | Create | atomicity + cross-process |
| `src/app/api/line/admin/intents/intent-response.ts` | Create | map `IntentWriteResult` → HTTP error |
| `src/app/api/line/admin/intents/route.ts` | Modify | POST ใช้ `createIntent` |
| `src/app/api/line/admin/intents/[id]/route.ts` | Rewrite | PATCH/DELETE ใช้ store |
| `src/app/api/line/admin/intents/route.integration.test.ts` | Create | POST/PATCH/DELETE |
| `AGENTS.md` | Modify `:241` | อธิบายกติกา cache ใหม่ |

---

### Task 0: เตรียม branch

**Files:** ไม่มี

- [ ] **Step 1: ตรวจ working tree**

Run: `git status --short`
Expected: ตอนเขียนแผนนี้มีไฟล์ค้างอยู่ (` M .gitignore`, ` M AGENTS.md`, ` M next-env.d.ts` และไฟล์ untracked หลายไฟล์) — **ถ้ายังมี tracked file ที่ modified ให้หยุดและถามผู้ใช้** ว่าจะ commit/stash ไว้ที่ branch เดิมหรือไม่ ห้าม stash หรือทิ้งเอง (โดยเฉพาะ `AGENTS.md` ที่ Task 9 จะแก้ ถ้าพาการแก้ค้างติดมาจะปนเข้า commit นี้) ไฟล์ untracked ปล่อยไว้ได้

- [ ] **Step 2: สร้าง branch จาก main ล่าสุด**

```bash
git checkout main && git pull && git checkout -b feat/bot-config-module
```

Expected: `Switched to a new branch 'feat/bot-config-module'`

- [ ] **Step 3: ยืนยัน baseline เขียว**

```bash
docker compose up -d postgres redis up-redis
npx tsc --noEmit && npx vitest run
```

Expected: tsc ไม่มี output, vitest `Test Files  N passed` ทั้งหมด ถ้า baseline แดงตั้งแต่ต้น ให้หยุดและรายงาน ห้ามใช้ `npx eslint .` เป็นเกณฑ์เขียว — baseline มี 21 errors / 3 warnings ที่ไม่เกี่ยวกับแผนนี้

---

### Task 1: Pure module เวลาทำการ

**Files:**
- Create: `src/lib/line/business-hours.ts`
- Test: `src/lib/line/business-hours.test.ts`

**Interfaces:**
- Consumes: ไม่มี (pure, ไม่ import อะไร — ปลอดภัยใน client bundle)
- Produces:
  - `interface BusinessHours { start: string; end: string; days: number[] }`
  - `const BUSINESS_DAY_LABELS: readonly ['อา','จ','อ','พ','พฤ','ศ','ส']`
  - `parseClockMinutes(value: unknown): number | null`
  - `bangkokClock(now: Date): { day: number; minutes: number }`
  - `isWithinBusinessHours(hours: BusinessHours | null | undefined, now: Date): boolean`
  - `formatBusinessHours(hours: BusinessHours): string`
  - `outsideBusinessHoursText(hours: BusinessHours): string`

- [ ] **Step 1: เขียน test ที่ fail**

สร้าง `src/lib/line/business-hours.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  BUSINESS_DAY_LABELS,
  bangkokClock,
  formatBusinessHours,
  isWithinBusinessHours,
  outsideBusinessHoursText,
  parseClockMinutes,
  type BusinessHours,
} from './business-hours';

const WEEKDAYS: BusinessHours = { start: '08:30', end: '16:30', days: [1, 2, 3, 4, 5] };

// fixture ทั้งหมดเขียนเป็น UTC (Z) เพื่อให้ผลไม่ขึ้นกับ TZ ของเครื่องที่รันเทสต์
// 2026-10-05 = วันจันทร์, 2026-10-10 = วันเสาร์ (เวลาไทย)
const MON_0830_TH = new Date('2026-10-05T01:30:00Z');
const MON_0829_TH = new Date('2026-10-05T01:29:00Z');
const MON_1629_TH = new Date('2026-10-05T09:29:00Z');
const MON_1630_TH = new Date('2026-10-05T09:30:00Z');
const SAT_1000_TH = new Date('2026-10-10T03:00:00Z');
const MON_0030_TH_BUT_SUN_UTC = new Date('2026-10-04T17:30:00Z');
const SAT_0030_TH_BUT_FRI_UTC = new Date('2026-10-09T17:30:00Z');

describe('parseClockMinutes', () => {
  it.each([
    ['00:00', 0],
    ['08:30', 510],
    ['23:59', 1439],
    ['24:00', 1440],
  ])('แปลง %s เป็น %i นาที', (input, expected) => {
    expect(parseClockMinutes(input)).toBe(expected);
  });

  it.each(['24:01', '25:00', '08:60', '8:30', '0830', '', null, undefined, 830])(
    'คืน null สำหรับค่าที่ไม่ใช่ HH:MM ที่ถูกต้อง (%s)',
    (input) => {
      expect(parseClockMinutes(input)).toBeNull();
    },
  );
});

describe('bangkokClock', () => {
  it('ใช้วันและเวลาตามเวลาไทย ไม่ใช่ UTC', () => {
    expect(bangkokClock(MON_0030_TH_BUT_SUN_UTC)).toEqual({ day: 1, minutes: 30 });
    expect(bangkokClock(SAT_0030_TH_BUT_FRI_UTC)).toEqual({ day: 6, minutes: 30 });
  });
});

describe('isWithinBusinessHours', () => {
  it('เวลาเปิดนับรวม (08:30 = อยู่ในเวลา)', () => {
    expect(isWithinBusinessHours(WEEKDAYS, MON_0830_TH)).toBe(true);
  });

  it('ก่อนเวลาเปิดหนึ่งนาที = นอกเวลา', () => {
    expect(isWithinBusinessHours(WEEKDAYS, MON_0829_TH)).toBe(false);
  });

  it('เวลาปิดไม่นับรวม (16:29 อยู่ในเวลา, 16:30 นอกเวลา)', () => {
    expect(isWithinBusinessHours(WEEKDAYS, MON_1629_TH)).toBe(true);
    expect(isWithinBusinessHours(WEEKDAYS, MON_1630_TH)).toBe(false);
  });

  it('วันที่ไม่อยู่ใน days = นอกเวลา', () => {
    expect(isWithinBusinessHours(WEEKDAYS, SAT_1000_TH)).toBe(false);
  });

  it('ตัดสินวันด้วยวันตามเวลาไทย', () => {
    const mondayAllDay: BusinessHours = { start: '00:00', end: '24:00', days: [1] };
    const sundayAllDay: BusinessHours = { start: '00:00', end: '24:00', days: [0] };
    expect(isWithinBusinessHours(mondayAllDay, MON_0030_TH_BUT_SUN_UTC)).toBe(true);
    expect(isWithinBusinessHours(sundayAllDay, MON_0030_TH_BUT_SUN_UTC)).toBe(false);
    expect(isWithinBusinessHours(WEEKDAYS, SAT_0030_TH_BUT_FRI_UTC)).toBe(false);
  });

  it("'24:00' ครอบคลุมถึงสิ้นวัน", () => {
    const allDay: BusinessHours = { start: '00:00', end: '24:00', days: [0, 1, 2, 3, 4, 5, 6] };
    expect(isWithinBusinessHours(allDay, new Date('2026-10-05T16:59:00Z'))).toBe(true); // 23:59 ไทย
  });

  it('days ว่าง = ปิดทุกวัน', () => {
    expect(isWithinBusinessHours({ ...WEEKDAYS, days: [] }, MON_1629_TH)).toBe(false);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['days ไม่ใช่ array', { start: '08:30', end: '16:30', days: 'จันทร์' } as unknown as BusinessHours],
    ['start ผิดรูป', { ...WEEKDAYS, start: '8.30' }],
    ['start >= end', { ...WEEKDAYS, start: '16:30', end: '08:30' }],
  ])('§ ค่าเสีย (%s) → fail-open ถือว่าอยู่ในเวลาทำการ', (_label, hours) => {
    expect(isWithinBusinessHours(hours, SAT_1000_TH)).toBe(true);
  });
});

describe('formatBusinessHours / outsideBusinessHoursText', () => {
  it('ป้ายชื่อวันเรียงตาม getDay (0 = อาทิตย์)', () => {
    expect(BUSINESS_DAY_LABELS[0]).toBe('อา');
    expect(BUSINESS_DAY_LABELS[1]).toBe('จ');
    expect(BUSINESS_DAY_LABELS[6]).toBe('ส');
  });

  it('จัดรูปวัน (เรียง, ไม่ซ้ำ) และช่วงเวลา', () => {
    expect(formatBusinessHours({ start: '08:30', end: '16:30', days: [5, 1, 3, 1] })).toBe(
      'วัน จ, พ, ศ เวลา 08:30–16:30 น.',
    );
  });

  it('days ว่าง → บอกว่ายังไม่ได้กำหนดวันทำการ', () => {
    expect(formatBusinessHours({ ...WEEKDAYS, days: [] })).toBe('ยังไม่ได้กำหนดวันทำการ');
  });

  it('ข้อความนอกเวลาบอกเวลาทำการและคำสั่งที่บอทยังทำได้', () => {
    const text = outsideBusinessHoursText(WEEKDAYS);
    expect(text).toContain('นอกเวลาทำการ');
    expect(text).toContain('วัน จ, อ, พ, พฤ, ศ เวลา 08:30–16:30 น.');
    expect(text).toContain('แจ้งเรื่องใหม่');
    expect(text).toContain('ติดตาม HG');
  });
});
```

- [ ] **Step 2: รันให้เห็นว่า fail**

Run: `npx vitest run src/lib/line/business-hours.test.ts`
Expected: FAIL — `Failed to resolve import "./business-hours"`

- [ ] **Step 3: เขียน implementation**

สร้าง `src/lib/line/business-hours.ts`:

```ts
/**
 * เวลาทำการของเจ้าหน้าที่ (chatSettings.business_hours)
 *
 * pure module (ไม่ import อะไร) — ใช้ได้ทั้งบอทฝั่ง server และหน้า settings ฝั่ง client
 * ทุกฟังก์ชันรับ `now` จากผู้เรียก ไม่อ่านนาฬิกาเอง เพื่อให้ test กำหนดเวลาได้แน่นอน
 */

export interface BusinessHours {
  /** 'HH:MM' เวลาไทย — นับรวมนาทีนี้ */
  start: string;
  /** 'HH:MM' เวลาไทย — ไม่นับรวมนาทีนี้; '24:00' = สิ้นวัน */
  end: string;
  /** เลขวันแบบ Date#getDay: 0 = อาทิตย์ … 6 = เสาร์ */
  days: number[];
}

/** ป้ายชื่อวันเรียงตาม getDay — หน้า settings ใช้ชุดเดียวกันนี้ */
export const BUSINESS_DAY_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as const;

// § ประเทศไทยไม่มี DST — offset +07:00 คงที่ตลอดปี จึงบวกเวลาแล้วอ่านด้วย getUTC* ได้
// ผลเหมือนกันทุกเครื่อง ไม่ขึ้นกับ TZ ของ process (Vercel = UTC, เครื่อง dev = Asia/Bangkok)
// ห้ามเปลี่ยนไปใช้ getDay()/getHours() ตรง ๆ — บน Vercel จะคลาด 7 ชั่วโมงแบบเงียบ ๆ
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const MINUTES_PER_DAY = 24 * 60;

export function parseClockMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59) return null;
  const total = hours * 60 + minutes;
  return total <= MINUTES_PER_DAY ? total : null;
}

export function bangkokClock(now: Date): { day: number; minutes: number } {
  const shifted = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  return {
    day: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

export function isWithinBusinessHours(
  hours: BusinessHours | null | undefined,
  now: Date,
): boolean {
  // § ค่าใน DB เป็น jsonb ที่ไม่มีใคร validate ตอนอ่าน — ถ้าเสียให้ถือว่า "อยู่ในเวลาทำการ"
  // เพื่อคงพฤติกรรมเดิม (handoff ได้เสมอ) แทนที่จะปิดช่องทางคุยกับเจ้าหน้าที่ทั้งหมดแบบเงียบ ๆ
  if (!hours || !Array.isArray(hours.days)) return true;
  const start = parseClockMinutes(hours.start);
  const end = parseClockMinutes(hours.end);
  if (start === null || end === null || start >= end) return true;

  const { day, minutes } = bangkokClock(now);
  return hours.days.includes(day) && minutes >= start && minutes < end;
}

export function formatBusinessHours(hours: BusinessHours): string {
  const labels = [...new Set(hours.days)]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => a - b)
    .map((d) => BUSINESS_DAY_LABELS[d]);
  if (labels.length === 0) return 'ยังไม่ได้กำหนดวันทำการ';
  return `วัน ${labels.join(', ')} เวลา ${hours.start}–${hours.end} น.`;
}

export function outsideBusinessHoursText(hours: BusinessHours): string {
  return [
    'ขณะนี้อยู่นอกเวลาทำการของเจ้าหน้าที่',
    `(${formatBusinessHours(hours)})`,
    '',
    'กรุณาติดต่อเจ้าหน้าที่อีกครั้งในเวลาทำการ ระหว่างนี้ยังใช้บริการได้:',
    '• "แจ้งเรื่องใหม่" — แจ้งเรื่อง',
    '• "ติดตาม HGxxxxxxxxx" — ตรวจสอบสถานะ',
  ].join('\n');
}
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run src/lib/line/business-hours.test.ts`
Expected: PASS ทุกเคส

- [ ] **Step 5: Commit**

```bash
git add src/lib/line/business-hours.ts src/lib/line/business-hours.test.ts
git commit -m "feat(line): pure module ประเมินเวลาทำการตามเวลาไทย"
```

---

### Task 2: Engine อ่าน `bot_enabled` และ `business_hours`

**Files:**
- Modify: `src/lib/line/bot/engine.ts:1-18` (imports), `:101-170` (`handleMessageEvent`), `:172-178` (signature `routeBotMessage`), `:242-244` (handoff branch)
- Modify: `src/lib/line/bot/engine.test.ts:24-32`
- Test: `src/lib/line/bot/engine.config.test.ts`

**Interfaces:**
- Consumes: `isWithinBusinessHours`, `outsideBusinessHoursText` จาก Task 1; `getChatSetting('bot_enabled' | 'business_hours')` จาก `../settings` (API เดิม); `changeMode`, `recordBotReplies`, `httpLineTransport` จาก `../conversation` (c4 — ต้องมีแล้วก่อน Task 2)
- Produces:
  - `routeBotMessage(db, event, text, lineUserPk, conversationId, now?: Date): Promise<LineOutgoingMessage[]>` — พารามิเตอร์ที่ 6 ใหม่ default `new Date()`
  - `export const BOT_DISABLED_TEXT: string`

- [ ] **Step 1: เขียน test ที่ fail**

สร้าง `src/lib/line/bot/engine.config.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// § mock db แบบ chain — select() คืน [] เสมอ จึงเข้าเส้นทาง "user/conversation ใหม่"
// (conversation ใหม่มี mode = 'bot_active') ส่วน set() แยกเป็นตัวแปรเพื่อตรวจ payload ที่ update
const setMock = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })),
    })),
  })),
  insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
  update: vi.fn(() => ({ set: setMock })),
} as never;

const BASE_SETTINGS: Record<string, unknown> = {
  handoff_keywords: ['ติดต่อเจ้าหน้าที่'],
  welcome_message: 'สวัสดี',
  bot_enabled: true,
  bot_engine_v2: false,
  business_hours: { start: '08:30', end: '16:30', days: [1, 2, 3, 4, 5] },
};
let settings: Record<string, unknown> = { ...BASE_SETTINGS };

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => mockDb) }));
vi.mock('../settings', () => ({
  getChatSetting: vi.fn(async (key: string) => settings[key]),
}));
vi.mock('./intent-matcher', () => ({ matchIntent: vi.fn(async () => null) }));
vi.mock('./faq-matcher', () => ({ matchFaq: vi.fn(async () => null) }));
vi.mock('../client', () => ({
  getProfile: vi.fn(async () => null),
  replyMessage: vi.fn(async () => {}),
  pushMessage: vi.fn(async () => {}),
  sendTypingIndicator: vi.fn(async () => {}),
}));
const changeModeMock = vi.hoisted(() => vi.fn(async () => ({ ok: true as const, changed: true })));
vi.mock('../conversation', () => ({
  changeMode: changeModeMock,
  recordBotReplies: vi.fn(async () => {}),
  httpLineTransport: { reply: vi.fn(async () => {}), push: vi.fn(async () => {}), showTyping: vi.fn(async () => {}), getProfile: vi.fn(async () => null) },
  recordInboundMessage: vi.fn(async () => ({ messageId: 'msg-1' })),
  isHumanHandled: (mode: string) => mode === 'human_active' || mode === 'waiting_handoff',
}));
vi.mock('../sse/broadcaster', () => ({ broadcast: vi.fn() }));
vi.mock('../messages/flex', () => ({
  caseStatusFlex: vi.fn(() => ({ type: 'flex', altText: 'สถานะ', contents: { type: 'bubble' } })),
  handoffNotifyFlex: vi.fn(() => ({ type: 'flex', altText: 'กำลังเชื่อมต่อเจ้าหน้าที่', contents: { type: 'bubble' } })),
}));

import { BOT_DISABLED_TEXT, handleEvent, routeBotMessage } from './engine';
import { matchFaq } from './faq-matcher';
import { sendTypingIndicator } from '../client';
import { httpLineTransport } from '../conversation';

const MON_1000_TH = new Date('2026-10-05T03:00:00Z');
const SAT_1000_TH = new Date('2026-10-10T03:00:00Z');

function textEvent(text: string) {
  return {
    type: 'message',
    replyToken: 'reply-token',
    timestamp: Date.now(),
    mode: 'active',
    webhookEventId: 'evt-1',
    source: { type: 'user', userId: 'U123' },
    message: { type: 'text', id: 'msg-1', text },
  } as never;
}

function conversationUpdatePayload(): Record<string, unknown> {
  // set() ครั้งแรกใน handleMessageEvent คือการอัปเดต lastMessage/unreadAdmin ของ conversation
  const call = setMock.mock.calls[0] as unknown as [Record<string, unknown>] | undefined;
  if (!call) throw new Error('ไม่มีการอัปเดต conversation');
  return call[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  settings = { ...BASE_SETTINGS };
});

describe('handleEvent — bot_enabled', () => {
  it('บอทเปิด: ส่งต่อให้บอทตอบ และ unreadAdmin = 0', async () => {
    await handleEvent(textEvent('สวัสดีครับ'));

    expect(sendTypingIndicator).toHaveBeenCalledTimes(1);
    expect(matchFaq).toHaveBeenCalledTimes(1);
    expect(conversationUpdatePayload().unreadAdmin).toBe(0);
    expect(replyMessage).toHaveBeenCalledTimes(1);
  });

  it('บอทปิด: ไม่เข้า routeBotMessage, ย้ายห้องไป waiting_handoff, ตอบแจ้งครั้งเดียว', async () => {
    settings = { ...BASE_SETTINGS, bot_enabled: false };

    await handleEvent(textEvent('สวัสดีครับ'));

    expect(sendTypingIndicator).not.toHaveBeenCalled();
    expect(matchFaq).not.toHaveBeenCalled();
    expect(conversationUpdatePayload().unreadAdmin).not.toBe(0);
    expect(changeModeMock).toHaveBeenCalledWith(expect.any(String), 'waiting_handoff');
    expect(httpLineTransport.reply).toHaveBeenCalledTimes(1);
    expect(httpLineTransport.reply).toHaveBeenCalledWith('reply-token', [{ type: 'text', text: BOT_DISABLED_TEXT }]);
  });
});

describe('routeBotMessage — business_hours ที่ทางแยก handoff', () => {
  it('ในเวลาทำการ: handoff ตามปกติ (flex แจ้งเจ้าหน้าที่ + mode = waiting_handoff)', async () => {
    const replies = await routeBotMessage(
      mockDb, textEvent('ติดต่อเจ้าหน้าที่'), 'ติดต่อเจ้าหน้าที่', 'user-pk', 'conv-1', MON_1000_TH,
    );

    expect(replies[0]!.type).toBe('flex');
    expect(changeModeMock).toHaveBeenCalledWith('conv-1', 'waiting_handoff');
  });

  it('นอกเวลาทำการ: ตอบข้อความนอกเวลา และไม่เปลี่ยน mode', async () => {
    const replies = await routeBotMessage(
      mockDb, textEvent('ติดต่อเจ้าหน้าที่'), 'ติดต่อเจ้าหน้าที่', 'user-pk', 'conv-1', SAT_1000_TH,
    );

    expect(replies).toHaveLength(1);
    expect((replies[0] as { text: string }).text).toContain('นอกเวลาทำการ');
    expect(changeModeMock).not.toHaveBeenCalled();
  });

  it('นอกเวลาทำการ: ติดตามสถานะยังใช้ได้', async () => {
    const replies = await routeBotMessage(
      mockDb, textEvent('ติดตาม'), 'ติดตาม', 'user-pk', 'conv-1', SAT_1000_TH,
    );

    expect((replies[0] as { text: string }).text).toContain('HG');
  });
});
```

- [ ] **Step 2: รันให้เห็นว่า fail**

Run: `npx vitest run src/lib/line/bot/engine.config.test.ts`
Expected: FAIL — `BOT_DISABLED_TEXT` เป็น `undefined` / เคส "บอทปิด" ได้ `sendTypingIndicator` ถูกเรียก, เคส "นอกเวลาทำการ" ได้ `flex`

- [ ] **Step 3: แก้ imports ของ `engine.ts`**

เพิ่มต่อจากบรรทัด `import { getChatSetting } from '../settings';`:

```ts
import { isWithinBusinessHours, outsideBusinessHoursText } from '../business-hours';
import { changeMode, httpLineTransport, recordBotReplies } from '../conversation';
```

- [ ] **Step 4: แก้ `handleMessageEvent` (`engine.ts:129-170`)**

แทนที่ตั้งแต่ `await db` บรรทัดที่ 129 (update conversation) จนจบฟังก์ชันที่บรรทัด 170 ด้วย:

```ts
  // § อ่าน bot_enabled ก่อนอัปเดต conversation — ถ้าบอทปิด ข้อความนี้ไม่มีใครตอบอัตโนมัติ
  // จึงต้องนับเป็น unread ของเจ้าหน้าที่ (เดิม reset เป็น 0 เพราะถือว่าบอทตอบแล้ว)
  const botEnabled = await getChatSetting('bot_enabled');
  const staffHandling = mode === 'human_active' || mode === 'waiting_handoff';
  const routedToStaff = staffHandling || !botEnabled;

  await db
    .update(chatConversations)
    .set({
      lastMessageText: textContent ?? `[${messageType}]`,
      lastMessageAt: new Date(),
      lastMessageSender: 'user',
      unreadAdmin: routedToStaff
        ? sql`${chatConversations.unreadAdmin} + 1`
        : 0,
      updatedAt: new Date(),
    })
    .where(eq(chatConversations.id, conversationId));

  broadcast({
    type: 'new_message',
    conversationId,
    payload: { id: messageId, sender: 'user', messageType, textContent, createdAt: new Date().toISOString() },
  });
  broadcast({ type: 'conversation_update', conversationId, payload: { lastMessageText: textContent ?? `[${messageType}]` } });

  if (staffHandling) {
    return;
  }

  if (!botEnabled) {
    await routeToStaffWhileBotDisabled(event.replyToken, conversationId);
    return;
  }

  await sendTypingIndicator(event.source.userId);

  const replies = await routeBotMessage(db, event, textContent, lineUserPk, conversationId);

  for (const reply of replies) {
    await db.insert(chatMessages).values({
      id: generateId(),
      conversationId,
      sender: 'bot',
      messageType: reply.type === 'text' ? 'text' : 'flex',
      textContent: reply.type === 'text' ? reply.text : null,
      flexPayload: reply.type === 'flex' ? reply.contents : null,
    });
  }

  await replyMessage(event.replyToken, replies.slice(0, 5));
}

export const BOT_DISABLED_TEXT =
  'ขณะนี้ระบบตอบกลับอัตโนมัติปิดให้บริการชั่วคราว\nได้ส่งข้อความของท่านถึงเจ้าหน้าที่แล้ว เจ้าหน้าที่จะตอบกลับโดยเร็วที่สุดในเวลาทำการ';

// § บอทปิด → ย้ายห้องเข้าคิวเจ้าหน้าที่ (waiting_handoff) ผ่าน changeMode ของ c4
// ห้าม UPDATE mode ตรง — สอง event ที่อ่าน bot_active พร้อมกันจะส่ง notice สองครั้งและทับห้องที่ admin claim แทรก
// ตอบ notice เฉพาะผู้ที่ changeMode สำเร็จ (changed: true) คนที่แพ้ race ไม่ตอบซ้ำ
// หลัง c4 merge แล้ว: บันทึกข้อความบอทผ่าน recordBotReplies และตอบผ่าน transport.reply ไม่เรียก client ตรง
async function routeToStaffWhileBotDisabled(replyToken: string, conversationId: string) {
  const changed = await changeMode(conversationId, 'waiting_handoff');
  if (!changed.ok || !changed.changed) return;

  await recordBotReplies(conversationId, [{ type: 'text', text: BOT_DISABLED_TEXT }]);
  await httpLineTransport.reply(replyToken, [{ type: 'text', text: BOT_DISABLED_TEXT }]);
}
```

- [ ] **Step 5: เพิ่มพารามิเตอร์ `now` ให้ `routeBotMessage` (`engine.ts:172-178`)**

```ts
export async function routeBotMessage(
  db: Db,
  event: LineMessageEvent,
  text: string | null,
  lineUserPk: string,
  conversationId: string,
  now: Date = new Date(),
): Promise<LineOutgoingMessage[]> {
```

- [ ] **Step 6: ตรวจเวลาทำการที่ทางแยก handoff (`engine.ts:242-244`)**

แทนที่

```ts
  if (await isHandoffRequest(text)) {
    return triggerHandoff(conversationId);
  }
```

ด้วย

```ts
  if (await isHandoffRequest(text)) {
    // § นอกเวลาทำการไม่ย้ายเข้า waiting_handoff — ไม่งั้นบอทจะเงียบทั้งคืน (แม้ผู้ใช้พิมพ์
    // "ติดตาม …") จนเจ้าหน้าที่เข้างาน บอกตรง ๆ ว่านอกเวลาแล้วให้ใช้บริการอัตโนมัติไปก่อน
    const hours = await getChatSetting('business_hours');
    if (!isWithinBusinessHours(hours, now)) {
      return [{ type: 'text', text: outsideBusinessHoursText(hours) }];
    }
    return triggerHandoff(conversationId);
  }
```

- [ ] **Step 7: เติม `business_hours` ใน mock ของ `engine.test.ts` (`:25-30`)**

เดิม test handoff ใน `engine.test.ts` ไม่ส่ง `now` — ถ้าไม่เติม จะพึ่ง fail-open ของค่า `undefined` ซึ่งไม่ใช่เจตนา ใช้ช่วง "ทั้งวันทุกวัน" ให้ผลไม่ขึ้นกับเวลาที่รัน:

```ts
    const defaults: Record<string, unknown> = {
      handoff_keywords: ['ติดต่อเจ้าหน้าที่', 'เจ้าหน้าที่', 'คุยกับคน', 'พบเจ้าหน้าที่', 'handoff', 'operator', 'admin'],
      welcome_message: 'สวัสดี',
      bot_enabled: true,
      bot_engine_v2: true,
      // ทุกวันทั้งวัน — test handoff เดิมไม่ส่ง now จึงต้องอยู่ในเวลาทำการเสมอ
      business_hours: { start: '00:00', end: '24:00', days: [0, 1, 2, 3, 4, 5, 6] },
    };
```

- [ ] **Step 8: รันให้ผ่าน**

Run: `npx vitest run src/lib/line/bot`
Expected: PASS ทั้ง `engine.config.test.ts`, `engine.test.ts`, `handoff.test.ts`, `welcome.test.ts`, `case-flow.test.ts`

- [ ] **Step 9: typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/lib/line`
Expected: ไม่มี output

- [ ] **Step 10: Commit**

```bash
git add src/lib/line/bot/engine.ts src/lib/line/bot/engine.test.ts src/lib/line/bot/engine.config.test.ts
git commit -m "feat(line): บอทเคารพ bot_enabled และเวลาทำการตอน handoff"
```

---

### Task 3: Versioned cache (pure)

**Files:**
- Create: `src/lib/line/versioned-cache.ts`
- Test: `src/lib/line/versioned-cache.test.ts`

**Interfaces:**
- Consumes: ไม่มี
- Produces:
  - `const BOT_CONFIG_TTL_MS = 60_000`, `const BOT_CONFIG_VERSION_CHECK_MS = 3_000`
  - `interface VersionedCacheOptions<T> { load: () => Promise<T>; readVersion: () => Promise<string | null>; ttlMs: number; versionCheckMs: number; now?: () => number }`
  - `interface VersionedCache<T> { get(): Promise<T>; invalidate(): void }`
  - `createVersionedCache<T>(opts: VersionedCacheOptions<T>): VersionedCache<T>`

- [ ] **Step 1: เขียน test ที่ fail**

สร้าง `src/lib/line/versioned-cache.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createVersionedCache } from './versioned-cache';

function setup(initialVersion: string | null = '1') {
  let clock = 1_000_000;
  let version: string | null = initialVersion;
  let loads = 0;
  const readVersion = vi.fn(async () => version);
  const cache = createVersionedCache<number>({
    load: async () => {
      loads += 1;
      return loads;
    },
    readVersion,
    ttlMs: 60_000,
    versionCheckMs: 3_000,
    now: () => clock,
  });
  return {
    cache,
    readVersion,
    advance: (ms: number) => {
      clock += ms;
    },
    setVersion: (next: string | null) => {
      version = next;
    },
    loadCount: () => loads,
  };
}

describe('createVersionedCache', () => {
  it('โหลดครั้งแรก แล้วตอบจาก memory โดยไม่ถาม Redis ภายใน versionCheckMs', async () => {
    const t = setup();
    expect(await t.cache.get()).toBe(1);
    t.advance(2_999);
    expect(await t.cache.get()).toBe(1);
    expect(t.loadCount()).toBe(1);
    expect(t.readVersion).toHaveBeenCalledTimes(1); // ครั้งเดียวตอนโหลด
  });

  it('ครบรอบเช็คแล้ว version เดิม → ไม่โหลดใหม่', async () => {
    const t = setup();
    await t.cache.get();
    t.advance(3_000);
    expect(await t.cache.get()).toBe(1);
    expect(t.loadCount()).toBe(1);
    expect(t.readVersion).toHaveBeenCalledTimes(2);
  });

  it('version เปลี่ยน → โหลดใหม่', async () => {
    const t = setup();
    await t.cache.get();
    t.setVersion('2');
    t.advance(3_000);
    expect(await t.cache.get()).toBe(2);
  });

  it('หลังเช็คแล้วไม่ถาม Redis ซ้ำจนครบรอบใหม่', async () => {
    const t = setup();
    await t.cache.get();
    t.advance(3_000);
    await t.cache.get();
    t.advance(1_000);
    await t.cache.get();
    expect(t.readVersion).toHaveBeenCalledTimes(2);
  });

  it('Redis ล่ม (version = null) → ใช้ค่าเดิมจนครบ TTL แล้วจึงโหลดใหม่', async () => {
    const t = setup();
    await t.cache.get();
    t.setVersion(null);
    t.advance(3_000);
    expect(await t.cache.get()).toBe(1);
    t.advance(57_000); // รวม 60_000 นับจากโหลด
    expect(await t.cache.get()).toBe(2);
  });

  it('โหลดตอน Redis ยังไม่มี key แล้วภายหลังมีเลข version → โหลดใหม่', async () => {
    const t = setup(null);
    await t.cache.get();
    t.setVersion('5');
    t.advance(3_000);
    expect(await t.cache.get()).toBe(2);
  });

  it('invalidate() → get ครั้งถัดไปโหลดใหม่ทันที', async () => {
    const t = setup();
    await t.cache.get();
    t.cache.invalidate();
    expect(await t.cache.get()).toBe(2);
  });

  it('§ writer แทรกกลาง await ของ reload เก่า → ค่าใหม่ไม่ถูกเขียนทับ', async () => {
    let releaseFirst!: () => void;
    const firstLoad = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let loads = 0;
    const cache = createVersionedCache<number>({
      load: async () => {
        loads += 1;
        if (loads === 1) await firstLoad;
        return loads;
      },
      readVersion: async () => String(loads),
      ttlMs: 60_000,
      versionCheckMs: 3_000,
      now: () => 0,
    });

    const stale = cache.get();
    await vi.waitFor(() => expect(loads).toBe(1));
    cache.invalidate();
    await expect(cache.get()).resolves.toBe(2);
    releaseFirst();
    await expect(stale).resolves.toBe(1);
    await expect(cache.get()).resolves.toBe(2);
  });

  it('load พัง → error ส่งต่อถึงผู้เรียก และครั้งถัดไปลองโหลดใหม่', async () => {
    let attempt = 0;
    const cache = createVersionedCache<string>({
      load: async () => {
        attempt += 1;
        if (attempt === 1) throw new Error('db down');
        return 'ok';
      },
      readVersion: async () => '1',
      ttlMs: 60_000,
      versionCheckMs: 3_000,
      now: () => 0,
    });
    await expect(cache.get()).rejects.toThrow('db down');
    await expect(cache.get()).resolves.toBe('ok');
  });
});
```

- [ ] **Step 2: รันให้เห็นว่า fail**

Run: `npx vitest run src/lib/line/versioned-cache.test.ts`
Expected: FAIL — `Failed to resolve import "./versioned-cache"`

- [ ] **Step 3: เขียน implementation**

สร้าง `src/lib/line/versioned-cache.ts`:

```ts
/**
 * cache ใน memory ที่ "เห็นการเขียนจาก process อื่น" ผ่านเลข version ภายนอก (Redis)
 *
 * - ภายใน versionCheckMs หลังเช็คล่าสุด → ตอบจาก memory ไม่แตะ Redis (ไม่เพิ่ม latency ต่อข้อความ)
 * - ครบรอบ → อ่าน version; ถ้าต่างจากตอนโหลด → โหลดใหม่
 * - อ่าน version ไม่ได้ (null) → ใช้ค่าเดิมจนครบ ttlMs (พฤติกรรมเดิมก่อนมี version)
 *
 * pure: ไม่ import อะไร — ผู้เรียก inject load/readVersion/now เพื่อให้ test คุมได้ทั้งหมด
 */

export const BOT_CONFIG_TTL_MS = 60_000;
export const BOT_CONFIG_VERSION_CHECK_MS = 3_000;

export interface VersionedCacheOptions<T> {
  load: () => Promise<T>;
  readVersion: () => Promise<string | null>;
  ttlMs: number;
  versionCheckMs: number;
  now?: () => number;
}

export interface VersionedCache<T> {
  get(): Promise<T>;
  invalidate(): void;
}

interface Entry<T> {
  value: T;
  loadedAt: number;
  checkedAt: number;
  version: string | null;
}

export function createVersionedCache<T>(opts: VersionedCacheOptions<T>): VersionedCache<T> {
  // § ต้องเป็น arrow ที่อ่าน Date.now ตอนเรียก ไม่ใช่เก็บ reference `Date.now` ไว้ตอนสร้าง —
  // integration test ใช้ vi.useFakeTimers({ toFake: ['Date'] }) ซึ่งสลับ global Date ภายหลัง
  const now = opts.now ?? (() => Date.now());
  let entry: Entry<T> | null = null;
  let generation = 0;

  async function reload(): Promise<T> {
    // § อ่าน version "ก่อน" load — ถ้ามีคนเขียนแทรกระหว่าง load เราจะถือ version เก่า
    // แล้วรอบเช็คถัดไปจะเห็นว่าเปลี่ยนและโหลดใหม่ ถ้าสลับลำดับจะพลาดการเขียนนั้นจนครบ TTL
    const ticket = ++generation;
    const version = await opts.readVersion();
    const value = await opts.load();
    // § generation/in-flight: writer ที่ invalidate หรือ reload ใหม่กว่าแทรกกลาง await
    // ต้องทิ้งผลนี้ ห้ามเขียน entry ทับค่าที่ใหม่กว่า
    if (ticket !== generation) return value;
    const at = now();
    entry = { value, loadedAt: at, checkedAt: at, version };
    return value;
  }

  return {
    async get() {
      const current = entry;
      if (!current || now() - current.loadedAt >= opts.ttlMs) return reload();
      if (now() - current.checkedAt < opts.versionCheckMs) return current.value;

      const ticket = generation;
      const version = await opts.readVersion();
      // invalidate/reload แทรกระหว่าง await — อย่าฟื้นค่าเก่าด้วยการเขียน checkedAt ทับ
      if (ticket !== generation || entry !== current) return reload();
      if (version !== null && version !== current.version) return reload();

      entry = { ...current, checkedAt: now() };
      return current.value;
    },
    invalidate() {
      generation += 1;
      entry = null;
    },
  };
}
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run src/lib/line/versioned-cache.test.ts`
Expected: PASS 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/line/versioned-cache.ts src/lib/line/versioned-cache.test.ts
git commit -m "feat(line): versioned cache — เทียบเลข version ภายนอก พร้อม TTL fallback"
```

---

### Task 4: เลข version ใน Redis

**Files:**
- Create: `src/lib/line/config-version.ts`
- Test: `src/lib/line/config-version.test.ts`, `src/lib/line/config-version.integration.test.ts`

**Interfaces:**
- Consumes: `redis` จาก `@/lib/upstash`
- Produces:
  - `type BotConfigScope = 'settings' | 'intents'`
  - `configVersionKey(scope: BotConfigScope): string` → `'bot-config:version:<scope>'`
  - `readConfigVersion(scope: BotConfigScope): Promise<string | null>` (ไม่ throw)
  - `bumpConfigVersion(scope: BotConfigScope): Promise<void>` (ไม่ throw)

- [ ] **Step 1: เขียน unit test ที่ fail**

สร้าง `src/lib/line/config-version.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const redisMock = vi.hoisted(() => ({ get: vi.fn(), incr: vi.fn() }));
vi.mock('@/lib/upstash', () => ({ redis: redisMock }));

// § module อ่าน env ตอน load (เหมือน sse/broadcaster.ts) จึงต้อง reset แล้ว import ใหม่ทุกเคส
async function loadModule(redisConfigured: boolean) {
  vi.resetModules();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', redisConfigured ? 'http://redis.test' : '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', redisConfigured ? 'unit-test-token-xx' : '');
  return import('./config-version');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  redisMock.get.mockReset();
  redisMock.incr.mockReset();
});

describe('config-version', () => {
  it('key แยกตาม scope', async () => {
    const mod = await loadModule(true);
    expect(mod.configVersionKey('settings')).toBe('bot-config:version:settings');
    expect(mod.configVersionKey('intents')).toBe('bot-config:version:intents');
  });

  it('อ่านเลข version เป็น string (Upstash คืนตัวเลขหลัง INCR)', async () => {
    const mod = await loadModule(true);
    redisMock.get.mockResolvedValue(7);
    await expect(mod.readConfigVersion('settings')).resolves.toBe('7');
    expect(redisMock.get).toHaveBeenCalledWith('bot-config:version:settings');
  });

  it('ยังไม่มี key → null', async () => {
    const mod = await loadModule(true);
    redisMock.get.mockResolvedValue(null);
    await expect(mod.readConfigVersion('intents')).resolves.toBeNull();
  });

  it('Redis error → null (ไม่ throw)', async () => {
    const mod = await loadModule(true);
    redisMock.get.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(mod.readConfigVersion('settings')).resolves.toBeNull();
  });

  it('§ Redis ค้างเกิน 500ms → null ไม่ถ่วงการตอบ webhook', async () => {
    const mod = await loadModule(true);
    vi.useFakeTimers();
    redisMock.get.mockReturnValue(new Promise(() => {}));
    const pending = mod.readConfigVersion('settings');
    await vi.advanceTimersByTimeAsync(500);
    await expect(pending).resolves.toBeNull();
  });

  it('ไม่มี env Upstash → ไม่เรียก Redis เลย', async () => {
    const mod = await loadModule(false);
    await expect(mod.readConfigVersion('settings')).resolves.toBeNull();
    await mod.bumpConfigVersion('settings');
    expect(redisMock.get).not.toHaveBeenCalled();
    expect(redisMock.incr).not.toHaveBeenCalled();
  });

  it('bump เรียก INCR และกลืน error (การเขียนลง DB สำเร็จไปแล้ว)', async () => {
    const mod = await loadModule(true);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    redisMock.incr.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(mod.bumpConfigVersion('intents')).resolves.toBeUndefined();
    expect(redisMock.incr).toHaveBeenCalledWith('bot-config:version:intents');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: รันให้เห็นว่า fail**

Run: `npx vitest run src/lib/line/config-version.test.ts`
Expected: FAIL — `Failed to resolve import "./config-version"`

- [ ] **Step 3: เขียน implementation**

สร้าง `src/lib/line/config-version.ts`:

```ts
import { redis } from '@/lib/upstash';

/**
 * เลข version ของค่าบอทใน Redis — สะพานให้ cache ของแต่ละ process รู้ว่ามีคนเขียนค่าใหม่
 *
 * § เหตุที่ต้องมี: cache ค่าบอทอยู่ใน memory ของแต่ละ process และบน Vercel route admin
 * ที่บันทึกค่ากับ webhook ที่อ่านค่าเป็นคนละ lambda (เหตุผลเดียวกับ § ใน sse/broadcaster.ts)
 * invalidate ใน process ตัวเองจึงไปไม่ถึงบอท — ผู้เขียน INCR เลขนี้ ผู้อ่านเทียบเป็นระยะ
 * ทุกฟังก์ชันในไฟล์นี้ไม่ throw: Redis ล่มแค่ทำให้ช้าลงเป็น TTL 60 วินาทีแบบเดิม
 */

export type BotConfigScope = 'settings' | 'intents';

// ไม่มี env Upstash (dev/test ที่ไม่ได้ยก up-redis) → ไม่เรียก Redis เลย
// เพราะ client ที่ชี้ host stub จะ retry หลายวินาทีต่อคำสั่ง ถ่วงการตอบทุกข้อความ
const REDIS_ENABLED = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);
const READ_TIMEOUT_MS = 500;

export function configVersionKey(scope: BotConfigScope): string {
  return `bot-config:version:${scope}`;
}

export async function readConfigVersion(scope: BotConfigScope): Promise<string | null> {
  if (!REDIS_ENABLED) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), READ_TIMEOUT_MS);
    });
    const value = await Promise.race([
      redis.get<string | number>(configVersionKey(scope)),
      timeout,
    ]);
    return value === null || value === undefined ? null : String(value);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function bumpConfigVersion(scope: BotConfigScope): Promise<void> {
  if (!REDIS_ENABLED) return;
  try {
    await redis.incr(configVersionKey(scope));
  } catch {
    // ไม่ log error detail (secret/PII risk เหมือน upstash.ts) — ค่าใน DB บันทึกสำเร็จแล้ว
    console.warn(`[bot-config] bump version ของ ${scope} ไม่สำเร็จ — process อื่นจะเห็นค่าใหม่หลัง TTL`);
  }
}
```

- [ ] **Step 4: รัน unit test ให้ผ่าน**

Run: `npx vitest run src/lib/line/config-version.test.ts`
Expected: PASS 7 tests

- [ ] **Step 5: เขียน integration test (Redis จริง)**

สร้าง `src/lib/line/config-version.integration.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { bumpConfigVersion, configVersionKey, readConfigVersion } from './config-version';
import { redis } from '@/lib/upstash';

/**
 * Integration — ต้องมี `docker compose up -d redis up-redis`
 * § พิสูจน์สิ่งที่ mock พิสูจน์ไม่ได้: up-redis/Upstash คืนค่า INCR ผ่าน GET ในรูปที่
 * readConfigVersion แปลงเป็น string ได้ และเลขเพิ่มขึ้นจริงทีละ 1
 * (ไม่ลบ key หลังเทสต์ — ลบแล้ว dev server ที่รันอยู่จะเห็น version เป็น null และรอ TTL แทน)
 */
describe('config-version · Redis จริง', () => {
  test('bump แล้วอ่านได้เลขที่มากขึ้น', async () => {
    const before = Number((await readConfigVersion('intents')) ?? '0');
    await bumpConfigVersion('intents');
    const after = await readConfigVersion('intents');
    expect(after).toMatch(/^\d+$/);
    // ไม่ assert ว่า +1 พอดี — ไฟล์ intents อื่นที่รันขนานกันก็ bump scope นี้ด้วย
    expect(Number(after)).toBeGreaterThan(before);
  });

  test('ค่าที่ readConfigVersion คืนตรงกับ GET ดิบ', async () => {
    // § ใช้ scope 'intents' เท่านั้น — vitest รันไฟล์ขนานกัน ถ้าไฟล์นี้ bump 'settings'
    // จะไปรบกวนเทสต์ TTL fallback ใน settings.integration.test.ts ที่ต้องการให้ version นิ่ง
    await bumpConfigVersion('intents');
    const raw = await redis.get<string | number>(configVersionKey('intents'));
    expect(await readConfigVersion('intents')).toBe(String(raw));
  });
});
```

- [ ] **Step 6: รัน integration test**

Run: `npx vitest run src/lib/line/config-version.integration.test.ts`
Expected: PASS 2 tests (ถ้าได้ `null` ทุกครั้ง แปลว่า `.env.local` ไม่มี `UPSTASH_REDIS_REST_URL` หรือ up-redis ไม่ได้รันที่ `:8081`)

- [ ] **Step 7: Commit**

```bash
git add src/lib/line/config-version.ts src/lib/line/config-version.test.ts src/lib/line/config-version.integration.test.ts
git commit -m "feat(line): เลข version ค่าบอทใน Redis สำหรับ cache ข้าม process"
```

---

### Task 5: `settings.ts` ใช้ versioned cache + เขียนใน transaction

**Files:**
- Rewrite: `src/lib/line/settings.ts`
- Test: `src/lib/line/settings.integration.test.ts`

**Interfaces:**
- Consumes: `createVersionedCache`, `BOT_CONFIG_TTL_MS`, `BOT_CONFIG_VERSION_CHECK_MS` (Task 3); `readConfigVersion`, `bumpConfigVersion`, `configVersionKey` (Task 4); `BusinessHours` (Task 1)
- Produces:
  - `interface ChatSettingsDefaults` (เดิม; `business_hours: BusinessHours`)
  - `getChatSetting<K>(key: K): Promise<ChatSettingsDefaults[K]>` (signature เดิม)
  - `setChatSettings(patch: Partial<ChatSettingsDefaults>): Promise<void>` (ใหม่)
  - **ลบ** `setChatSetting` และ `invalidateSettingsCache` (ผู้เรียกเดียวคือ settings route ซึ่งแก้ใน Task 6)

**ทำไม test ของ settings ทั้ง module และ route อยู่ไฟล์เดียว:** vitest รันคนละไฟล์ขนานกัน ทั้งสองชุดเขียนแถวเดียวกันใน `chat_settings` และ bump version `settings` ตัวเดียวกัน ถ้าแยกไฟล์ snapshot/restore จะทับกันเอง และเทสต์ TTL fallback (ที่ต้องการให้ version นิ่ง) จะ flaky — ในไฟล์เดียวเทสต์รันตามลำดับ

- [ ] **Step 1: เขียน integration test ที่ fail**

สร้าง `src/lib/line/settings.integration.test.ts`:

```ts
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { chatSettings } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { redis } from '@/lib/upstash';
import { getChatSetting, setChatSettings } from './settings';
import { configVersionKey, readConfigVersion } from './config-version';

/**
 * Integration — ต้องมี `docker compose up -d postgres redis up-redis`
 *
 * § "อีก process" จำลองด้วย vi.resetModules() แล้ว import settings ใหม่ — ได้ module instance
 * ที่มี cache ใน memory ของตัวเอง (เหมือน webhook lambda) ส่วน instance ที่ import ด้านบน
 * ทำหน้าที่เป็น admin route ที่บันทึกค่า
 *
 * § chat_settings ใน dev DB คือค่าที่เครื่อง dev ใช้งานจริง — เก็บทั้งชุดก่อนเทสต์และคืนกลับหลังเทสต์
 */

type SettingsRow = typeof chatSettings.$inferSelect;
let snapshot: SettingsRow[] = [];
const isolatedDbClosers: Array<() => Promise<void>> = [];

async function loadOtherProcess() {
  vi.resetModules();
  const settings = await import('./settings');
  const db = await import('@/lib/db');
  isolatedDbClosers.push(db.closeDb);
  return settings;
}

beforeAll(async () => {
  const db = await getDb();
  snapshot = await db.select().from(chatSettings);
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.delete(chatSettings);
    if (snapshot.length > 0) await tx.insert(chatSettings).values(snapshot);
  });
  // ให้ dev server ที่รันอยู่โหลดค่าที่คืนกลับทันที (Redis ล่มก็ไม่เป็นไร — รอ TTL)
  await redis.incr(configVersionKey('settings')).catch(() => undefined);
  await Promise.all(isolatedDbClosers.map((close) => close()));
  await closeDb();
});

describe('settings · process เดียวกัน', () => {
  test('setChatSettings แล้ว getChatSetting เห็นค่าใหม่ทันที', async () => {
    await setChatSettings({ bot_enabled: true });
    expect(await getChatSetting('bot_enabled')).toBe(true);

    await setChatSettings({
      bot_enabled: false,
      business_hours: { start: '09:00', end: '15:00', days: [1, 3] },
    });
    expect(await getChatSetting('bot_enabled')).toBe(false);
    expect(await getChatSetting('business_hours')).toEqual({ start: '09:00', end: '15:00', days: [1, 3] });
  });

  test('ทุกครั้งที่เขียน เลข version ใน Redis เพิ่มขึ้น 1', async () => {
    const before = Number((await readConfigVersion('settings')) ?? '0');
    await setChatSettings({ bot_enabled: true });
    expect(await readConfigVersion('settings')).toBe(String(before + 1));
  });

  test('ไม่มีแถวใน DB → ใช้ค่า default', async () => {
    const db = await getDb();
    await db.delete(chatSettings).where(eq(chatSettings.key, 'welcome_message'));
    await setChatSettings({ bot_enabled: true }); // ล้าง cache ของ process นี้
    expect(await getChatSetting('welcome_message')).toContain('ยินดีต้อนรับ');
  });

  test('เขียน key เดิมซ้ำเป็น upsert ไม่เกิดแถวซ้ำ', async () => {
    await setChatSettings({ bot_enabled: false });
    await setChatSettings({ bot_enabled: true });
    const db = await getDb();
    const rows = await db.select().from(chatSettings).where(eq(chatSettings.key, 'bot_enabled'));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.value).toBe(true);
  });
});

describe('settings · ข้าม process', () => {
  test('process อื่นเห็นค่าที่บันทึกภายในไม่กี่วินาที โดยไม่มีใครเรียก invalidate', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await setChatSettings({ bot_enabled: true });

    const webhook = await loadOtherProcess();
    expect(await webhook.getChatSetting('bot_enabled')).toBe(true); // อุ่น cache

    await setChatSettings({ bot_enabled: false });
    // ยังอยู่ในรอบเช็ค 3 วินาที — ตอบจาก memory (พิสูจน์ว่าไม่ได้ยิง DB ทุกข้อความ)
    expect(await webhook.getChatSetting('bot_enabled')).toBe(true);

    vi.setSystemTime(Date.now() + 3_500);
    expect(await webhook.getChatSetting('bot_enabled')).toBe(false);
  });

  test('§ เขียนตรง DB โดยไม่ bump version → อีก process เห็นค่าใหม่เมื่อครบ TTL (fallback)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await setChatSettings({ business_hours: { start: '08:30', end: '16:30', days: [1, 2, 3, 4, 5] } });

    const webhook = await loadOtherProcess();
    expect((await webhook.getChatSetting('business_hours')).start).toBe('08:30');

    const db = await getDb();
    const changed = { start: '10:00', end: '12:00', days: [2] };
    await db
      .insert(chatSettings)
      .values({ id: generateId(), key: 'business_hours', value: changed })
      .onConflictDoUpdate({ target: chatSettings.key, set: { value: changed, updatedAt: new Date() } });

    vi.setSystemTime(Date.now() + 3_500);
    expect((await webhook.getChatSetting('business_hours')).start).toBe('08:30'); // version ไม่เปลี่ยน

    vi.setSystemTime(Date.now() + 60_000);
    expect(await webhook.getChatSetting('business_hours')).toEqual(changed);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่า fail**

Run: `npx vitest run src/lib/line/settings.integration.test.ts`
Expected: FAIL — `setChatSettings is not a function` (ยังไม่มี export นี้)

- [ ] **Step 3: เขียน `settings.ts` ใหม่ทั้งไฟล์**

```ts
import { getDb } from '../db';
import { chatSettings } from '../db/schema';
import { generateId } from '../id';
import { COPY } from '@/lib/copy';
import type { BusinessHours } from './business-hours';
import { bumpConfigVersion, readConfigVersion } from './config-version';
import {
  BOT_CONFIG_TTL_MS,
  BOT_CONFIG_VERSION_CHECK_MS,
  createVersionedCache,
} from './versioned-cache';

export interface ChatSettingsDefaults {
  welcome_message: string;
  handoff_keywords: string[];
  business_hours: BusinessHours;
  bot_enabled: boolean;
  bot_engine_v2: boolean;
}

const DEFAULTS: ChatSettingsDefaults = {
  // § ข้อความนี้เป็นเพียง fallback — ถ้า prod เคยบันทึก welcome_message ไว้ใน
  // chatSettings แล้ว ค่าใน DB จะ override ตลอด ต้องอัปเดตผ่านหน้า admin ด้วย
  welcome_message:
    `สวัสดีครับ/ค่ะ ยินดีต้อนรับสู่ ${COPY.ORG_SHORT} 🏛️\n\nเลือกเมนูด้านล่างหรือพิมพ์:\n• ${COPY.INTAKE_LABEL} — แจ้งเรื่อง (เปิดฟอร์มกรอกใน LINE ได้เลย)\n• ${COPY.TRACK_LABEL} — ติดตามสถานะเรื่อง\n• ติดต่อเจ้าหน้าที่ — พูดคุยกับเจ้าหน้าที่`,
  handoff_keywords: [
    'ติดต่อเจ้าหน้าที่',
    'เจ้าหน้าที่',
    'คุยกับคน',
    'พบเจ้าหน้าที่',
    'handoff',
    'operator',
    'admin',
  ],
  business_hours: { start: '08:30', end: '16:30', days: [1, 2, 3, 4, 5] },
  bot_enabled: true,
  bot_engine_v2: false,
};

function isSettingKey(key: string): key is keyof ChatSettingsDefaults {
  return Object.hasOwn(DEFAULTS, key);
}

function isClock(value: unknown): value is string {
  return typeof value === 'string' && /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(value);
}

/** normalize ค่าเก่าตอนอ่าน — ไม่ทำ schema migration; ชนิดเสีย fallback เป็น default ของ key นั้น */
function normalizeSetting(key: keyof ChatSettingsDefaults, value: unknown): ChatSettingsDefaults[typeof key] | undefined {
  if (key === 'bot_enabled' || key === 'bot_engine_v2') {
    return typeof value === 'boolean' ? value : undefined;
  }
  if (key === 'handoff_keywords') {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0)) return undefined;
    return value;
  }
  if (key === 'business_hours') {
    if (!value || typeof value !== 'object') return undefined;
    const hours = value as { start?: unknown; end?: unknown; days?: unknown };
    const daysOk = Array.isArray(hours.days)
      && hours.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6);
    if (!isClock(hours.start) || !isClock(hours.end) || hours.start >= hours.end || !daysOk) return undefined;
    return { start: hours.start, end: hours.end, days: [...new Set(hours.days as number[])].sort((a, b) => a - b) };
  }
  if (key === 'welcome_message') {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }
  return undefined;
}

// โหลดทุก key ในคิวรีเดียว (ตารางมีไม่กี่แถว) แทนการคิวรีทีละ key แบบเดิม
async function loadAllSettings(): Promise<ChatSettingsDefaults> {
  const db = await getDb();
  const rows = await db
    .select({ key: chatSettings.key, value: chatSettings.value })
    .from(chatSettings);
  const overrides: Partial<ChatSettingsDefaults> = {};
  for (const row of rows) {
    if (!isSettingKey(row.key) || row.value === null) continue;
    const normalized = normalizeSetting(row.key, row.value);
    if (normalized !== undefined) overrides[row.key] = normalized as never;
  }
  return { ...DEFAULTS, ...overrides };
}

const settingsCache = createVersionedCache({
  load: loadAllSettings,
  readVersion: () => readConfigVersion('settings'),
  ttlMs: BOT_CONFIG_TTL_MS,
  versionCheckMs: BOT_CONFIG_VERSION_CHECK_MS,
});

export async function getChatSetting<K extends keyof ChatSettingsDefaults>(
  key: K,
): Promise<ChatSettingsDefaults[K]> {
  const all = await settingsCache.get();
  return all[key];
}

/**
 * บันทึกค่าบอทหลาย key ใน transaction เดียว แล้วประกาศการเปลี่ยนแปลงให้ทุก process
 *
 * § ผู้เรียกไม่ต้อง (และไม่มีทาง) invalidate cache เอง — ฟังก์ชันนี้ล้าง cache ของ process นี้
 * และ INCR เลข version ใน Redis ให้ webhook process อื่นเห็นภายใน ~3 วินาที
 * ห้ามเพิ่ม export invalidate กลับมา: กติกา "ต้องจำเรียกหลังเขียน" คือบั๊กที่ module นี้มาแก้
 */
export async function setChatSettings(patch: Partial<ChatSettingsDefaults>): Promise<void> {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;

  const db = await getDb();
  await db.transaction(async (tx) => {
    for (const [key, value] of entries) {
      const json: unknown = JSON.parse(JSON.stringify(value));
      await tx
        .insert(chatSettings)
        .values({ id: generateId(), key, value: json })
        .onConflictDoUpdate({
          target: chatSettings.key,
          set: { value: json, updatedAt: new Date() },
        });
    }
  });

  settingsCache.invalidate();
  await bumpConfigVersion('settings');
}
```

หมายเหตุ: `tsc` จะแจ้ง error ที่ `src/app/api/line/admin/settings/route.ts` (ยัง import `setChatSetting`/`invalidateSettingsCache`) — แก้ใน Task 6 ทันทีถัดไป ห้าม commit Task 5 แยกจนกว่า tsc จะผ่าน จึง commit รวมกับ Task 6

- [ ] **Step 4: รัน integration test ให้ผ่าน**

Run: `npx vitest run src/lib/line/settings.integration.test.ts`
Expected: PASS 7 tests รวม fixture ค่าเก่า (vitest ไม่ type-check จึงรันได้แม้ route ยัง import ชื่อเก่า)

- [ ] **Step 5: ไปต่อ Task 6 ก่อน commit** — Task 5 กับ 6 commit รวมกันเพื่อให้ทุก commit ผ่าน `tsc`

---

### Task 6: Settings route + หน้า settings

**Files:**
- Modify: `src/app/api/line/admin/settings/route.ts:2`, `:10-19`, `:63-70`
- Modify: `src/app/admin/settings/settings-client.tsx:1-17`
- Test: `src/lib/line/settings.integration.test.ts` (เติมต่อจาก Task 5 — เหตุผลที่ไม่แยกไฟล์อยู่ใน Task 5)

**Interfaces:**
- Consumes: `getChatSetting`, `setChatSettings` (Task 5); `BUSINESS_DAY_LABELS` (Task 1)
- Produces: `PUT /api/line/admin/settings` ปฏิเสธ `business_hours` ที่ `start >= end` หรือเวลาไม่ถูกต้องด้วย 400 + ข้อความไทย; `days` ถูก dedupe + เรียง

- [ ] **Step 1: เติม route test ลงไฟล์ integration ของ settings**

ใน `src/lib/line/settings.integration.test.ts` เพิ่ม mock สองก้อนนี้ **ต่อจากบรรทัด import สุดท้าย** (vi.mock ถูก hoist อยู่แล้ว แต่วางบนสุดให้อ่านง่าย) และเพิ่ม import ของ route:

```ts
import { GET, PUT } from '@/app/api/line/admin/settings/route';

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaffApi: vi.fn(async () => ({
    ok: true,
    ctx: { user: { id: 'it-settings-admin' }, ipAddress: '127.0.0.1', userAgent: undefined },
  })),
}));
// § ตัด audit ออก — ไฟล์นี้ทดสอบการบันทึกค่าบอท ส่วน audit row ต้องมี user จริงใน DB
vi.mock('@/lib/audit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/audit')>()),
  logAudit: vi.fn(async () => {}),
}));
```

แล้วต่อท้ายไฟล์ด้วย:

```ts
function putRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/line/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('loadAllSettings — ค่าเก่าใน DB', () => {
  test('bot_enabled/hours/keywords ที่ชนิดเสีย fallback เป็น default ไม่ throw', async () => {
    const db = await getDb();
    const broken = [
      ['bot_enabled', 'false'],
      ['handoff_keywords', { bad: true }],
      ['business_hours', { start: '16:30', end: '08:30', days: [1] }],
    ] as const;
    for (const [key, value] of broken) {
      await db
        .insert(chatSettings)
        .values({ id: generateId(), key, value })
        .onConflictDoUpdate({ target: chatSettings.key, set: { value, updatedAt: new Date() } });
    }

    expect(await getChatSetting('bot_enabled')).toBe(true);
    expect(await getChatSetting('handoff_keywords')).toContain('ติดต่อเจ้าหน้าที่');
    expect(await getChatSetting('business_hours')).toEqual({ start: '08:30', end: '16:30', days: [1, 2, 3, 4, 5] });
  });
});

describe('PUT /api/line/admin/settings', () => {
  test('บันทึก bot_enabled + business_hours แล้วบอทอ่านค่าใหม่ได้ทันที', async () => {
    const res = await PUT(
      putRequest({ bot_enabled: false, business_hours: { start: '09:00', end: '15:30', days: [5, 1, 1] } }),
    );
    expect(res.status).toBe(200);
    expect(await getChatSetting('bot_enabled')).toBe(false);
    // days ถูก dedupe + เรียง
    expect(await getChatSetting('business_hours')).toEqual({ start: '09:00', end: '15:30', days: [1, 5] });
  });

  test.each([
    ['เวลาเปิดหลังเวลาปิด', { start: '16:30', end: '08:30', days: [1] }],
    ['เวลาเปิดเท่าเวลาปิด', { start: '08:30', end: '08:30', days: [1] }],
    ['ชั่วโมงเกิน 23', { start: '25:00', end: '26:00', days: [1] }],
    ['นาทีเกิน 59', { start: '08:60', end: '16:30', days: [1] }],
  ])('400 เมื่อ business_hours ไม่ถูกต้อง (%s) และค่าเดิมไม่เปลี่ยน', async (_label, hours) => {
    const before = await getChatSetting('business_hours');
    const res = await PUT(putRequest({ business_hours: hours }));
    expect(res.status).toBe(400);
    expect(await getChatSetting('business_hours')).toEqual(before);
  });
});

describe('GET /api/line/admin/settings', () => {
  test('คืนค่าที่บันทึกล่าสุด', async () => {
    await PUT(putRequest({ bot_enabled: true }));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { bot_enabled: boolean; business_hours: unknown };
    expect(body.bot_enabled).toBe(true);
    expect(body.business_hours).toHaveProperty('days');
  });
});
```

- [ ] **Step 2: รันให้เห็นว่า fail**

Run: `npx vitest run src/lib/line/settings.integration.test.ts`
Expected: FAIL เฉพาะ describe ของ route — `setChatSetting is not a function` ภายใน route (Task 5 ลบไปแล้ว); describe ของ module ยังผ่าน

- [ ] **Step 3: แก้ import (`route.ts:2`)**

```ts
import { getChatSetting, setChatSettings } from '@/lib/line/settings';
import { parseBody } from '@/lib/api-helpers';
```

- [ ] **Step 4: เข้มงวด schema (`route.ts:10-19`)**

```ts
// 'HH:MM' 00:00–23:59 หรือ '24:00' (= สิ้นวัน) — ตรงกับ parseClockMinutes ใน business-hours.ts
const CLOCK_PATTERN = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;

const settingsSchema = z.object({
  welcome_message: z.string().min(1).max(1000).optional(),
  handoff_keywords: z.array(z.string().min(1).max(50)).min(1).max(20).optional(),
  business_hours: z
    .object({
      start: z.string().regex(CLOCK_PATTERN, 'เวลาเปิดต้องอยู่ในรูปแบบ HH:MM'),
      end: z.string().regex(CLOCK_PATTERN, 'เวลาปิดต้องอยู่ในรูปแบบ HH:MM'),
      days: z.array(z.number().int().min(0).max(6)).max(7),
    })
    // § 'HH:MM' เติมศูนย์ครบ จึงเทียบแบบ string ได้ถูกต้อง — ไม่รองรับช่วงข้ามเที่ยงคืน
    // (บอทถือว่าค่าแบบนั้นเสียและ fail-open) จึงปฏิเสธตั้งแต่ตอนบันทึก
    .refine((hours) => hours.start < hours.end, { message: 'เวลาเปิดต้องมาก่อนเวลาปิด' })
    .transform((hours) => ({ ...hours, days: [...new Set(hours.days)].sort((a, b) => a - b) }))
    .optional(),
  bot_enabled: z.boolean().optional(),
});
```

- [ ] **Step 5: ใช้ `setChatSettings` (`route.ts:63-70`)**

แทนที่ loop `for (const [key, value] of entries) …` และ `invalidateSettingsCache();` ทั้งหมดด้วย:

```ts
  // § parseBody ของ c8 + schema เข้มของ c5 — ถ้า c8 merge ก่อน ห้าม revert กลับไป request.json()+safeParse
  const parsed = await parseBody(settingsSchema, request);
  if (!parsed.ok) return parsed.response;

  // § บันทึกทุก key ใน transaction เดียว และ setChatSettings ประกาศการเปลี่ยนแปลงให้
  // webhook process อื่นเอง — route ไม่ต้องเรียก invalidate อีกแล้ว
  await setChatSettings(parsed.data);
```

(ลบบรรทัด `const entries = …` และ import `ChatSettingsDefaults` ที่ไม่ได้ใช้แล้วด้วย)

- [ ] **Step 6: หน้า settings ใช้ป้ายชื่อวันชุดเดียวกับบอท (`settings-client.tsx:17`)**

ลบบรรทัด `const DAY_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];` แล้วเพิ่ม import ในกลุ่ม import ด้านบน:

```ts
import { BUSINESS_DAY_LABELS as DAY_LABELS } from '@/lib/line/business-hours';
```

(`business-hours.ts` ไม่ import อะไร จึงปลอดภัยใน client bundle; `DAY_LABELS.map(...)` ที่บรรทัด 151 ใช้ต่อได้เลย)

- [ ] **Step 7: รัน test ทั้ง Task 5 + 6**

Run: `npx vitest run src/lib/line/settings.integration.test.ts`
Expected: PASS ทุก describe (module, ข้าม process, PUT, GET)

- [ ] **Step 8: typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/lib/line src/app/api/line/admin/settings src/app/admin/settings`
Expected: ไม่มี output

- [ ] **Step 9: Commit (Task 5 + 6)**

```bash
git add src/lib/line/settings.ts src/lib/line/settings.integration.test.ts src/app/api/line/admin/settings/route.ts src/app/admin/settings/settings-client.tsx
git commit -m "feat(line): ค่าบอทเขียนใน transaction และ cache เห็นตรงกันข้าม process"
```

---

### Task 7: Intent store + matcher ใช้ versioned cache

**Files:**
- Modify: `src/lib/line/bot/intent-matcher.ts:1-4`, `:46-74`, `:87`
- Create: `src/lib/line/bot/intent-store.ts`
- Test: `src/lib/line/bot/intent-store.integration.test.ts`

**Interfaces:**
- Consumes: `createVersionedCache`, `BOT_CONFIG_*` (Task 3); `readConfigVersion`, `bumpConfigVersion` (Task 4); `Tx` จาก `@/lib/db`; `validateRegex` (เดิม)
- Produces:
  - `type IntentMatchType = 'exact' | 'starts_with' | 'contains' | 'regex'`
  - `interface IntentKeywordInput { keyword: string; matchType: IntentMatchType }`
  - `interface IntentResponseInput { replyType: 'text' | 'reply_object'; textContent?: string | null; replyObjectId?: string | null; displayOrder: number }`
  - `interface CreateIntentInput { name: string; description?: string | null; isActive: boolean; keywords: IntentKeywordInput[]; responses: IntentResponseInput[] }`
  - `interface UpdateIntentInput { name?: string; description?: string | null; isActive?: boolean; keywords?: IntentKeywordInput[]; responses?: IntentResponseInput[] }`
  - `type IntentWriteResult = { ok: true; id: string } | { ok: false; reason: 'not_found' } | { ok: false; reason: 'invalid_regex'; message: string }`
  - `createIntent(input: CreateIntentInput): Promise<IntentWriteResult>`
  - `updateIntent(id: string, patch: UpdateIntentInput): Promise<IntentWriteResult>`
  - `deleteIntent(id: string): Promise<IntentWriteResult>`
  - `invalidateIntentCache()` ยัง export จาก `intent-matcher.ts` แต่ **ผู้เรียกเดียวคือ `intent-store.ts`**

- [ ] **Step 1: เขียน integration test ที่ fail**

สร้าง `src/lib/line/bot/intent-store.integration.test.ts`:

```ts
import { eq, inArray } from 'drizzle-orm';
import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { chatIntentKeywords, chatIntentResponses, chatIntents } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { readConfigVersion } from '../config-version';
import { matchIntent } from './intent-matcher';
import { createIntent, deleteIntent, updateIntent, type CreateIntentInput } from './intent-store';

/**
 * Integration — ต้องมี `docker compose up -d postgres redis up-redis`
 * keyword ทุกตัวมี RUN ต่อท้าย (match แบบ exact) จึงไม่ชนกับ intents จริงใน dev DB
 */

const RUN = generateId();
const createdIds: string[] = [];
const isolatedDbClosers: Array<() => Promise<void>> = [];

function input(label: string): CreateIntentInput {
  return {
    name: `it-intent-${label}-${RUN}`,
    description: null,
    isActive: true,
    keywords: [{ keyword: `it-kw-${label}-${RUN}`, matchType: 'exact' }],
    responses: [{ replyType: 'text', textContent: `คำตอบ ${label}`, displayOrder: 0 }],
  };
}

async function create(label: string): Promise<string> {
  const result = await createIntent(input(label));
  if (!result.ok) throw new Error(`สร้าง intent ไม่สำเร็จ: ${result.reason}`);
  createdIds.push(result.id);
  return result.id;
}

async function keywordsOf(intentId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ keyword: chatIntentKeywords.keyword })
    .from(chatIntentKeywords)
    .where(eq(chatIntentKeywords.intentId, intentId));
  return rows.map((row) => row.keyword);
}

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  const db = await getDb();
  if (createdIds.length > 0) await db.delete(chatIntents).where(inArray(chatIntents.id, createdIds));
  await Promise.all(isolatedDbClosers.map((close) => close()));
  await closeDb();
});

describe('createIntent', () => {
  test('บันทึก intent + keywords + responses และ bump version', async () => {
    const before = Number((await readConfigVersion('intents')) ?? '0');
    const id = await create('create');

    expect(await keywordsOf(id)).toEqual([`it-kw-create-${RUN}`]);
    const db = await getDb();
    const responses = await db.select().from(chatIntentResponses).where(eq(chatIntentResponses.intentId, id));
    expect(responses).toHaveLength(1);
    // ไม่ assert +1 พอดี — intents/route.integration.test.ts รันขนานและ bump scope เดียวกัน
    expect(Number(await readConfigVersion('intents'))).toBeGreaterThan(before);
  });

  test('regex ไม่ถูกต้อง → invalid_regex และไม่มีแถวถูกสร้าง', async () => {
    const bad = { ...input('bad-regex'), keywords: [{ keyword: '(', matchType: 'regex' as const }] };
    const result = await createIntent(bad);
    expect(result).toMatchObject({ ok: false, reason: 'invalid_regex' });

    const db = await getDb();
    const rows = await db.select().from(chatIntents).where(eq(chatIntents.name, bad.name));
    expect(rows).toHaveLength(0);
  });
});

describe('updateIntent', () => {
  test('ไม่พบ id → not_found', async () => {
    await expect(updateIntent(`ไม่มีอยู่จริง-${RUN}`, { isActive: false })).resolves.toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  test('§ insert responses พัง → keywords ต้องไม่ถูกแทนที่ (ทั้งก้อนอยู่ใน transaction)', async () => {
    const id = await create('atomic');

    // replyObjectId ที่ไม่มีจริงชน FK chat_intent_responses.reply_object_id → insert ล้ม
    // หลังจากที่ลบ+ใส่ keywords ใหม่ไปแล้วในลำดับการทำงาน
    await expect(
      updateIntent(id, {
        keywords: [{ keyword: `it-kw-atomic-new-${RUN}`, matchType: 'exact' }],
        responses: [{ replyType: 'reply_object', replyObjectId: `ไม่มีอยู่จริง-${RUN}`, displayOrder: 0 }],
      }),
    ).rejects.toThrow();

    expect(await keywordsOf(id)).toEqual([`it-kw-atomic-${RUN}`]);
  });

  test('แทนที่ keywords แล้ว matchIntent ใน process เดียวกันเห็นทันที', async () => {
    const id = await create('replace');
    expect((await matchIntent(`it-kw-replace-${RUN}`))?.intentId).toBe(id);

    const result = await updateIntent(id, {
      keywords: [{ keyword: `it-kw-replace-new-${RUN}`, matchType: 'exact' }],
    });
    expect(result).toEqual({ ok: true, id });

    expect(await matchIntent(`it-kw-replace-${RUN}`)).toBeNull();
    expect((await matchIntent(`it-kw-replace-new-${RUN}`))?.intentId).toBe(id);
  });

  test('อีก process (webhook) เห็น keyword ใหม่ภายในไม่กี่วินาที โดยไม่มีใครเรียก invalidate', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const id = await create('cross');

    vi.resetModules();
    const webhookMatcher = await import('./intent-matcher');
    const webhookDb = await import('@/lib/db');
    isolatedDbClosers.push(webhookDb.closeDb);

    expect((await webhookMatcher.matchIntent(`it-kw-cross-${RUN}`))?.intentId).toBe(id); // อุ่น cache

    await updateIntent(id, { keywords: [{ keyword: `it-kw-cross-new-${RUN}`, matchType: 'exact' }] });
    expect(await webhookMatcher.matchIntent(`it-kw-cross-new-${RUN}`)).toBeNull(); // ยังอยู่ในรอบ 3 วินาที

    vi.setSystemTime(Date.now() + 3_500);
    expect((await webhookMatcher.matchIntent(`it-kw-cross-new-${RUN}`))?.intentId).toBe(id);
  });
});

describe('deleteIntent', () => {
  test('ลบแล้ว keywords หายตาม (cascade) และลบซ้ำได้ not_found', async () => {
    const id = await create('delete');
    await expect(deleteIntent(id)).resolves.toEqual({ ok: true, id });
    expect(await keywordsOf(id)).toEqual([]);
    await expect(deleteIntent(id)).resolves.toEqual({ ok: false, reason: 'not_found' });
  });
});
```

- [ ] **Step 2: รันให้เห็นว่า fail**

Run: `npx vitest run src/lib/line/bot/intent-store.integration.test.ts`
Expected: FAIL — `Failed to resolve import "./intent-store"`

- [ ] **Step 3: แก้ imports ของ `intent-matcher.ts` (`:1-4`)**

```ts
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatIntents, chatIntentKeywords, chatIntentResponses, chatReplyObjects } from '@/lib/db/schema';
import type { LineOutgoingMessage } from '../types';
import { readConfigVersion } from '../config-version';
import {
  BOT_CONFIG_TTL_MS,
  BOT_CONFIG_VERSION_CHECK_MS,
  createVersionedCache,
} from '../versioned-cache';
```

- [ ] **Step 4: แทน cache เดิม (`intent-matcher.ts:46-74`)**

แทนที่ตั้งแต่ `let keywordsCache …` จนจบ `invalidateIntentCache()` ด้วย:

```ts
async function loadActiveKeywords(): Promise<KeywordRow[]> {
  const db = await getDb();
  return db
    .select({
      keyword: chatIntentKeywords.keyword,
      matchType: chatIntentKeywords.matchType,
      intentId: chatIntents.id,
      intentName: chatIntents.name,
    })
    .from(chatIntentKeywords)
    .innerJoin(chatIntents, eq(chatIntentKeywords.intentId, chatIntents.id))
    .where(eq(chatIntents.isActive, true));
}

// § cache นี้เห็นการแก้ไขจาก admin process อื่นผ่านเลข version ใน Redis (scope 'intents')
// ดู config-version.ts — Redis ล่มก็ยังมี TTL 60 วินาทีแบบเดิม
const keywordCache = createVersionedCache<KeywordRow[]>({
  load: loadActiveKeywords,
  readVersion: () => readConfigVersion('intents'),
  ttlMs: BOT_CONFIG_TTL_MS,
  versionCheckMs: BOT_CONFIG_VERSION_CHECK_MS,
});

/** ผู้เรียกเดียวคือ intent-store.ts — route ไม่ต้องจำเรียกเองแล้ว */
export function invalidateIntentCache(): void {
  keywordCache.invalidate();
}
```

- [ ] **Step 5: ใช้ cache ใหม่ใน `matchIntent` (`intent-matcher.ts:87`)**

```ts
  const keywords = await keywordCache.get();
```

- [ ] **Step 6: สร้าง `src/lib/line/bot/intent-store.ts`**

```ts
import { eq } from 'drizzle-orm';
import { getDb, type Tx } from '@/lib/db';
import { chatIntentKeywords, chatIntentResponses, chatIntents } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { bumpConfigVersion } from '../config-version';
import { invalidateIntentCache, validateRegex } from './intent-matcher';

/**
 * ทางเขียน intents ทางเดียว — ทุกการเขียนอยู่ใน transaction และประกาศการเปลี่ยนแปลงให้
 * บอททุก process เอง (ล้าง cache ของ process นี้ + INCR version ใน Redis)
 * route จึงไม่ต้องจำเรียก invalidate อีก
 */

export type IntentMatchType = 'exact' | 'starts_with' | 'contains' | 'regex';

export interface IntentKeywordInput {
  keyword: string;
  matchType: IntentMatchType;
}

export interface IntentResponseInput {
  replyType: 'text' | 'reply_object';
  textContent?: string | null;
  replyObjectId?: string | null;
  displayOrder: number;
}

export interface CreateIntentInput {
  name: string;
  description?: string | null;
  isActive: boolean;
  keywords: IntentKeywordInput[];
  responses: IntentResponseInput[];
}

export interface UpdateIntentInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  keywords?: IntentKeywordInput[];
  responses?: IntentResponseInput[];
}

export type IntentWriteResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'invalid_regex'; message: string };

function findRegexError(keywords: IntentKeywordInput[] | undefined): string | null {
  for (const kw of keywords ?? []) {
    if (kw.matchType !== 'regex') continue;
    const check = validateRegex(kw.keyword);
    if (!check.valid) return check.error ?? 'invalid regex';
  }
  return null;
}

async function replaceKeywords(tx: Tx, intentId: string, keywords: IntentKeywordInput[]) {
  await tx.delete(chatIntentKeywords).where(eq(chatIntentKeywords.intentId, intentId));
  if (keywords.length === 0) return;
  await tx.insert(chatIntentKeywords).values(
    keywords.map((kw) => ({
      id: generateId(),
      intentId,
      keyword: kw.keyword,
      matchType: kw.matchType,
    })),
  );
}

async function replaceResponses(tx: Tx, intentId: string, responses: IntentResponseInput[]) {
  await tx.delete(chatIntentResponses).where(eq(chatIntentResponses.intentId, intentId));
  if (responses.length === 0) return;
  await tx.insert(chatIntentResponses).values(
    responses.map((r) => ({
      id: generateId(),
      intentId,
      replyType: r.replyType,
      textContent: r.textContent ?? null,
      replyObjectId: r.replyObjectId ?? null,
      displayOrder: r.displayOrder,
    })),
  );
}

async function publishIntentChange(): Promise<void> {
  invalidateIntentCache();
  await bumpConfigVersion('intents');
}

export async function createIntent(input: CreateIntentInput): Promise<IntentWriteResult> {
  const regexError = findRegexError(input.keywords);
  if (regexError) return { ok: false, reason: 'invalid_regex', message: regexError };

  const id = generateId();
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.insert(chatIntents).values({
      id,
      name: input.name,
      description: input.description ?? null,
      isActive: input.isActive,
    });
    await replaceKeywords(tx, id, input.keywords);
    await replaceResponses(tx, id, input.responses);
  });

  await publishIntentChange();
  return { ok: true, id };
}

export async function updateIntent(id: string, patch: UpdateIntentInput): Promise<IntentWriteResult> {
  const regexError = findRegexError(patch.keywords);
  if (regexError) return { ok: false, reason: 'invalid_regex', message: regexError };

  const { name, description, isActive, keywords, responses } = patch;
  const db = await getDb();

  // § ทั้งก้อนต้องอยู่ใน transaction เดียว — เดิมลบ keyword/response แล้ว insert ใหม่นอก
  // transaction ถ้า insert พัง (เช่น replyObjectId ที่ไม่มีจริงชน FK) intent จะเหลือ keyword
  // หรือคำตอบศูนย์ตัวค้างไว้ และบอทจะเงียบกับคำถามนั้นโดยไม่มีใครรู้
  const found = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: chatIntents.id })
      .from(chatIntents)
      .where(eq(chatIntents.id, id))
      .for('update');
    if (!existing) return false;

    await tx
      .update(chatIntents)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        updatedAt: new Date(),
      })
      .where(eq(chatIntents.id, id));

    if (keywords) await replaceKeywords(tx, id, keywords);
    if (responses) await replaceResponses(tx, id, responses);
    return true;
  });

  if (!found) return { ok: false, reason: 'not_found' };
  await publishIntentChange();
  return { ok: true, id };
}

export async function deleteIntent(id: string): Promise<IntentWriteResult> {
  const db = await getDb();
  // keywords/responses หายตามด้วย onDelete: 'cascade'
  const deleted = await db
    .delete(chatIntents)
    .where(eq(chatIntents.id, id))
    .returning({ id: chatIntents.id });
  if (deleted.length === 0) return { ok: false, reason: 'not_found' };

  await publishIntentChange();
  return { ok: true, id };
}
```

หมายเหตุพฤติกรรมที่ต่างจากเดิมเล็กน้อย: `updatedAt` ของ intent ถูกอัปเดตทุกครั้งที่ PATCH (เดิมอัปเดตเฉพาะเมื่อแก้ name/description/isActive) — ถูกต้องกว่าเพราะการแก้ keyword ก็คือการแก้ intent

- [ ] **Step 7: รันให้ผ่าน**

Run: `npx vitest run src/lib/line/bot/intent-store.integration.test.ts src/lib/line/bot/engine.test.ts src/lib/line/bot/engine.config.test.ts`
Expected: PASS ทั้งหมด (engine test mock `./intent-matcher` อยู่แล้ว ไม่กระทบ)

- [ ] **Step 8: typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/lib/line/bot`
Expected: ไม่มี output (route intents ยัง import `invalidateIntentCache` + `validateRegex` ได้ตามเดิม จึงยังผ่าน)

- [ ] **Step 9: Commit**

```bash
git add src/lib/line/bot/intent-matcher.ts src/lib/line/bot/intent-store.ts src/lib/line/bot/intent-store.integration.test.ts
git commit -m "feat(line): intent-store เขียน intents ใน transaction และ cache เห็นตรงกันข้าม process"
```

---

### Task 8: Intents routes ใช้ intent-store

**Files:**
- Create: `src/app/api/line/admin/intents/intent-response.ts`
- Modify: `src/app/api/line/admin/intents/route.ts:1-11`, `:61-116`
- Rewrite: `src/app/api/line/admin/intents/[id]/route.ts`
- Test: `src/app/api/line/admin/intents/route.integration.test.ts`

**Interfaces:**
- Consumes: `createIntent`, `updateIntent`, `deleteIntent`, `IntentWriteResult` (Task 7)
- Produces: `intentWriteErrorResponse(result: Exclude<IntentWriteResult, { ok: true }>): NextResponse` — 400 `regex ไม่ถูกต้อง: …` / 404 `ไม่พบ intent` (ข้อความเดิม); API contract ของ route ไม่เปลี่ยน

- [ ] **Step 1: เขียน integration test ที่ fail**

สร้าง `src/app/api/line/admin/intents/route.integration.test.ts`:

```ts
import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { chatIntentKeywords, chatIntents } from '@/lib/db/schema';
import { generateId } from '@/lib/id';

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaffApi: vi.fn(async () => ({
    ok: true,
    ctx: { user: { id: 'it-intents-admin' }, ipAddress: '127.0.0.1', userAgent: undefined },
  })),
}));
// § ตัด audit ออก — ไฟล์นี้ทดสอบการ map ผลของ intent-store เป็น HTTP ไม่ใช่ audit
vi.mock('@/lib/audit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/audit')>()),
  logAudit: vi.fn(async () => {}),
}));

import { POST } from './route';
import { DELETE, PATCH } from './[id]/route';

const RUN = generateId();
const createdIds: string[] = [];

function jsonRequest(method: string, body: unknown): Request {
  return new Request('http://localhost:3000/api/line/admin/intents', {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function createViaApi(label: string): Promise<string> {
  const res = await POST(
    jsonRequest('POST', {
      name: `it-route-intent-${label}-${RUN}`,
      keywords: [{ keyword: `it-route-kw-${label}-${RUN}`, matchType: 'exact' }],
      responses: [{ replyType: 'text', textContent: 'ทดสอบ' }],
    }),
  );
  expect(res.status).toBe(201);
  const { id } = (await res.json()) as { id: string };
  createdIds.push(id);
  return id;
}

afterAll(async () => {
  const db = await getDb();
  if (createdIds.length > 0) await db.delete(chatIntents).where(inArray(chatIntents.id, createdIds));
  await closeDb();
});

describe('POST /api/line/admin/intents', () => {
  test('201 + id', async () => {
    const id = await createViaApi('post');
    expect(id).toBeTruthy();
  });

  test('400 เมื่อ regex ไม่ถูกต้อง', async () => {
    const res = await POST(
      jsonRequest('POST', {
        name: `it-route-intent-bad-${RUN}`,
        keywords: [{ keyword: '(', matchType: 'regex' }],
        responses: [{ replyType: 'text', textContent: 'x' }],
      }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain('regex ไม่ถูกต้อง');
  });
});

describe('PATCH /api/line/admin/intents/[id]', () => {
  test('404 เมื่อไม่พบ', async () => {
    const res = await PATCH(jsonRequest('PATCH', { isActive: false }), params(`ไม่มีอยู่จริง-${RUN}`));
    expect(res.status).toBe(404);
  });

  test('400 เมื่อ regex ไม่ถูกต้อง', async () => {
    const id = await createViaApi('patch-bad');
    const res = await PATCH(
      jsonRequest('PATCH', { keywords: [{ keyword: '[', matchType: 'regex' }] }),
      params(id),
    );
    expect(res.status).toBe(400);
  });

  test('200 และแทนที่ keywords', async () => {
    const id = await createViaApi('patch-ok');
    const res = await PATCH(
      jsonRequest('PATCH', { keywords: [{ keyword: `it-route-kw-new-${RUN}`, matchType: 'exact' }] }),
      params(id),
    );
    expect(res.status).toBe(200);

    const db = await getDb();
    const rows = await db
      .select({ keyword: chatIntentKeywords.keyword })
      .from(chatIntentKeywords)
      .where(eq(chatIntentKeywords.intentId, id));
    expect(rows.map((r) => r.keyword)).toEqual([`it-route-kw-new-${RUN}`]);
  });
});

describe('DELETE /api/line/admin/intents/[id]', () => {
  test('200 แล้วลบซ้ำได้ 404', async () => {
    const id = await createViaApi('delete');
    const first = await DELETE(jsonRequest('DELETE', {}), params(id));
    expect(first.status).toBe(200);
    const second = await DELETE(jsonRequest('DELETE', {}), params(id));
    expect(second.status).toBe(404);
  });
});
```

- [ ] **Step 2: รันเพื่อดูสถานะก่อนแก้**

Run: `npx vitest run src/app/api/line/admin/intents/route.integration.test.ts`
Expected: PASS ทุกเคส **ตั้งแต่ก่อนแก้** — contract HTTP ไม่เปลี่ยน ไฟล์นี้คือ safety net ของ refactor (ไม่ใช่ RED แบบ TDD); ถ้ามีเคสแดงตั้งแต่ก่อนแก้ ให้หยุดและรายงาน เพราะแปลว่าพฤติกรรมเดิมต่างจากที่แผนเข้าใจ

- [ ] **Step 3: สร้าง `src/app/api/line/admin/intents/intent-response.ts`**

```ts
import { NextResponse } from 'next/server';
import type { IntentWriteResult } from '@/lib/line/bot/intent-store';

// แยกไฟล์เพราะ route.ts ของ Next.js export ได้เฉพาะ handler/config — export อื่นทำให้ build พัง
export function intentWriteErrorResponse(
  result: Exclude<IntentWriteResult, { ok: true }>,
): NextResponse {
  if (result.reason === 'invalid_regex') {
    return NextResponse.json({ error: `regex ไม่ถูกต้อง: ${result.message}` }, { status: 400 });
  }
  return NextResponse.json({ error: 'ไม่พบ intent' }, { status: 404 });
}
```

- [ ] **Step 4: แก้ `src/app/api/line/admin/intents/route.ts`**

imports (`:1-11`) เป็น:

```ts
import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatIntents, chatIntentKeywords, chatIntentResponses } from '@/lib/db/schema';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { createIntent } from '@/lib/line/bot/intent-store';
import { parseBody } from '@/lib/api-helpers';
import { z } from 'zod';
import { intentWriteErrorResponse } from './intent-response';
```

`POST` (`:61-116`) เป็น:

```ts
export async function POST(request: Request) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const parsed = await parseBody(createSchema, request);
  if (!parsed.ok) return parsed.response;

  // § intent-store ตรวจ regex, เขียนทั้งก้อนใน transaction และประกาศให้บอททุก process เอง
  const result = await createIntent(parsed.data);
  if (!result.ok) return intentWriteErrorResponse(result);

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.INTENT_CREATE,
    resource: 'chat_intents',
    resourceId: result.id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
```

(`GET` และ schema `keywordSchema`/`responseSchema`/`createSchema` คงเดิม)

- [ ] **Step 5: เขียน `src/app/api/line/admin/intents/[id]/route.ts` ใหม่ทั้งไฟล์**

```ts
import { NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { deleteIntent, updateIntent } from '@/lib/line/bot/intent-store';
import { parseBody } from '@/lib/api-helpers';
import { z } from 'zod';
import { intentWriteErrorResponse } from '../intent-response';

export const runtime = 'nodejs';

const keywordSchema = z.object({
  keyword: z.string().min(1).max(256),
  matchType: z.enum(['exact', 'starts_with', 'contains', 'regex']).default('contains'),
});

const responseSchema = z.object({
  replyType: z.enum(['text', 'reply_object']).default('text'),
  textContent: z.string().max(2000).nullable().optional(),
  replyObjectId: z.string().nullable().optional(),
  displayOrder: z.number().int().min(0).default(0),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  keywords: z.array(keywordSchema).min(1).max(50).optional(),
  responses: z.array(responseSchema).min(1).max(10).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const parsed = await parseBody(updateSchema, request);
  if (!parsed.ok) return parsed.response;

  // § intent-store ทำทั้งก้อนใน transaction — เดิมลบแล้ว insert ใหม่นอก transaction
  const result = await updateIntent(id, parsed.data);
  if (!result.ok) return intentWriteErrorResponse(result);

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.INTENT_UPDATE,
    resource: 'chat_intents',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const result = await deleteIntent(id);
  if (!result.ok) return intentWriteErrorResponse(result);

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.INTENT_DELETE,
    resource: 'chat_intents',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: ยืนยันว่าไม่มี route ไหนเรียก invalidate เองแล้ว**

Run: `graft build` ก่อน แล้ว `graft grep "invalidateIntentCache"` (ถ้า graft ไม่พร้อม ใช้ `rg -n "invalidateIntentCache|invalidateSettingsCache" src` — มี `rg` ในเครื่องแล้ว ห้าม `npx --yes rg`; บน PowerShell ใช้ `Get-ChildItem -Recurse -Include *.ts,*.tsx src | Select-String -Pattern "invalidateIntentCache|invalidateSettingsCache"`)
Expected: พบเฉพาะ `src/lib/line/bot/intent-matcher.ts` (นิยาม) และ `src/lib/line/bot/intent-store.ts` (ผู้เรียก) — ไม่มี `invalidateSettingsCache` เหลือเลย

- [ ] **Step 7: รัน test**

Run: `npx vitest run src/app/api/line/admin/intents/route.integration.test.ts src/lib/line/bot/intent-store.integration.test.ts`
Expected: PASS ทั้งหมด

- [ ] **Step 8: typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/app/api/line/admin/intents`
Expected: ไม่มี output

- [ ] **Step 9: Commit**

```bash
git add src/app/api/line/admin/intents/intent-response.ts src/app/api/line/admin/intents/route.ts "src/app/api/line/admin/intents/[id]/route.ts" src/app/api/line/admin/intents/route.integration.test.ts
git commit -m "refactor(line): intents routes เขียนผ่าน intent-store ไม่ต้องจำ invalidate"
```

---

### Task 9: เอกสาร + gate ทั้งระบบ

**Files:**
- Modify: `AGENTS.md:241`

**Interfaces:**
- Consumes: ทุก task ก่อนหน้า
- Produces: เอกสารที่ตรงกับโค้ด

- [ ] **Step 1: แก้ `AGENTS.md:241`**

แทนที่บรรทัด

```markdown
**Bot runtime config lives in the database, not env.** `lib/line/settings.ts` reads `chatSettings` with a 60-second in-process cache — call `invalidateSettingsCache(key)` after any write, or admin edits won't take effect for a minute.
```

ด้วย

```markdown
**Bot runtime config lives in the database, not env.** Write settings only through `setChatSettings()` (`lib/line/settings.ts`) and intents only through `createIntent`/`updateIntent`/`deleteIntent` (`lib/line/bot/intent-store.ts`). Both write in a transaction, clear their own process cache, and `INCR` a version stamp in Redis (`lib/line/config-version.ts`); every process's `createVersionedCache()` checks that stamp at most every 3 s, so the webhook sees admin edits within seconds. There is no invalidate call for callers to remember. If Redis is down the 60-second TTL is the fallback.

`bot_enabled = false` routes new messages to staff (`waiting_handoff`, one notice reply). Outside `business_hours` (Asia/Bangkok, `days` use `Date#getDay` numbering) the bot still answers FAQ/tracking but answers handoff requests with an "outside business hours" message instead of queueing — see `lib/line/business-hours.ts`.
```

ก่อน `git add` ให้รัน `git diff AGENTS.md` และยืนยันว่า diff มีเฉพาะการแก้นี้ (ถ้ามีการแก้อื่นค้างจาก Task 0 ให้หยุดถามผู้ใช้)

- [ ] **Step 2: Gate ทั้งระบบ**

```bash
docker compose up -d postgres redis up-redis
npx tsc --noEmit
npx eslint src/lib/line src/app/api/line/admin/settings src/app/api/line/admin/intents src/app/admin/settings
npx vitest run
```

Expected: tsc ไม่มี error; eslint เฉพาะไฟล์ที่แผนนี้แตะต้อง 0 error (ห้ามอ้าง `npx eslint .` exit 0 — baseline ของ repo มี 21 errors / 3 warnings ที่ไม่เกี่ยวกับแผนนี้ และห้ามแก้ในงานนี้); vitest ทุกไฟล์ผ่าน รวมไฟล์ใหม่ `business-hours.test.ts`, `versioned-cache.test.ts`, `config-version.test.ts`, `config-version.integration.test.ts`, `engine.config.test.ts`, `settings.integration.test.ts`, `intent-store.integration.test.ts`, `intents/route.integration.test.ts` และ contrast gate (`tokens.contrast.test.ts`) แผนนี้ไม่มี E2E — ถ้าภายหลังเพิ่ม spec ต้องเปิด dev server เองด้วย `npx next dev` ก่อน `npx playwright test` เพราะ `playwright.config.ts` webServer เรียก `pnpm dev` ซึ่งค้าง

- [ ] **Step 3: ตรวจด้วยมือบน dev server (ยืนยันพฤติกรรมจริง)**

```bash
npx next dev
```

1. เข้า `/admin/settings` → ติ๊ก "เปิดใช้งานบอทตอบอัตโนมัติ" ออก → บันทึก → ต้องขึ้น "บันทึกตั้งค่าสำเร็จ"
2. ตั้งเวลาเปิด 16:30 / ปิด 08:30 → บันทึก → ต้องขึ้นข้อความแดง "เวลาเปิดต้องมาก่อนเวลาปิด"
3. คืนค่าเดิม (เปิดบอท, 08:30–16:30, จ–ศ) → บันทึก

(การทดสอบผ่าน LINE จริงทำบน Vercel preview หลังเปิด PR — webhook ต้องการ URL สาธารณะ)

- [ ] **Step 4: Refresh graft graph (local, ไม่ได้ track ใน git)**

Run: `graft build`
Expected: build สำเร็จ ไม่มีไฟล์ใน `git status` เปลี่ยน (โฟลเดอร์ `graft/` ไม่ได้ track)

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): อธิบายกติกา cache ค่าบอทและพฤติกรรม bot_enabled/business_hours"
```

- [ ] **Step 6: Push + PR** (ทำเมื่อผู้ใช้สั่งเท่านั้น)

เขียน body ลงไฟล์ก่อน แล้วส่งด้วย `--body-file` (ห้าม `--body "..."` — placeholder และแตก newline บน PowerShell):

```powershell
@'
## สรุป
- ผู้ใช้ยืนยัน 2026-10-03: ทำให้ bot_enabled / business_hours มีผลจริง
- bot_enabled=false: ข้อความยังถูกบันทึก, changeMode ไป waiting_handoff, notice ครั้งเดียวเฉพาะผู้ที่เปลี่ยนโหมดสำเร็จ
- นอกเวลาทำการ: บอทยังตอบ FAQ/ติดตาม แต่ handoff ได้ข้อความนอกเวลา และไม่เข้าคิว
- cache ข้าม process ด้วย version stamp ใน Redis + TTL 60s; normalize ค่าเก่าตอนอ่าน ไม่ทำ schema migration

## Test plan
- [ ] npx tsc --noEmit
- [ ] npx eslint เฉพาะไฟล์ที่แตะ (0 error; ไม่ใช่ eslint ทั้ง repo — baseline 21 errors ไม่เกี่ยวกับแผนนี้)
- [ ] npx vitest run (Docker stack เปิด)
- [ ] Vercel preview: ปิดบอทแล้วส่งข้อความจาก LINE ได้ notice 1 ครั้ง ห้องโผล่ใน /admin/chat เป็นรอเจ้าหน้าที่
- [ ] Vercel preview: ตั้งเวลาทำการไม่ครอบคลุมตอนนี้ แล้วพิมพ์ "ติดต่อเจ้าหน้าที่" ได้ข้อความนอกเวลา
- [ ] Vercel preview: แก้ intent ในหน้า admin แล้วบอทตอบตาม keyword ใหม่ภายในไม่กี่วินาที

ติ๊ก checklist หลังรันจริงเท่านั้น ห้ามติ๊กเขียวล่วงหน้า
GitHub Actions ถูกพักไว้ — ไม่มี CI run เป็นเรื่องปกติ
'@ | Set-Content -Encoding utf8 pr-body.md
git push -u origin feat/bot-config-module
gh pr create --title "feat(line): bot_enabled/business_hours มีผลจริง + cache ค่าบอทข้าม process" --body-file pr-body.md
```

---

## Self-Review

**1. Spec coverage**

| ข้อกำหนด | Task |
|---|---|
| `bot_enabled` มีผลจริง (ไม่ตอบอัตโนมัติ, ข้อความยังถูกบันทึก, ส่งต่อเจ้าหน้าที่) | 2 |
| `business_hours` มีผลจริง (FAQ/ติดตามยังตอบ, handoff นอกเวลาได้ข้อความนอกเวลา) | 1, 2 |
| ประเมินเวลาเป็น pure function, inject `now`, timezone-safe, ยืนยันเลขวันกับ `toggleDay` | 1 (+ Global Constraints) |
| cache ข้าม process ด้วย version stamp ใน Redis + TTL fallback | 3, 4, 5, 7 |
| ผู้เขียน settings/intents ไม่ต้องจำ invalidate | 5, 6, 7, 8 (Step 6 ตรวจด้วย grep) |
| intents PATCH ใน transaction | 7 (test atomicity), 8 |
| unit test ส่วน pure + integration test กับ Postgres/Redis จริง | 1, 2, 3, 4 / 4, 5, 6, 7, 8 |
| Task 0 branch | 0 |
| `bot_engine_v2` ให้ admin แก้ได้ | ไม่ทำ — อยู่นอกการตัดสินใจของผู้ใช้ (บันทึกไว้ในหัวข้อการตัดสินใจ ข้อ 3) |
| regex validation ย้ายเข้า module (การ์ด c5 "ตรวจ regex ก่อนบันทึก") | 7 |

**2. Placeholder scan** — ทุก step ที่เป็นโค้ดมีโค้ดจริง; PR body อยู่ในไฟล์ `pr-body.md` ของ Task 9 Step 6 ไม่มี `--body "..."`

**3. Type consistency** — `BusinessHours` (Task 1) ใช้ใน `ChatSettingsDefaults.business_hours` (Task 5); `createVersionedCache`/`BOT_CONFIG_TTL_MS`/`BOT_CONFIG_VERSION_CHECK_MS` (Task 3) ใช้ตรงชื่อใน Task 5, 7; `readConfigVersion`/`bumpConfigVersion`/`configVersionKey` (Task 4) ใช้ตรงชื่อใน Task 5, 7 และ test helper; `setChatSettings` (Task 5) ใช้ใน Task 6; `IntentWriteResult` + `createIntent`/`updateIntent`/`deleteIntent` (Task 7) ใช้ใน Task 8; `routeBotMessage(..., now)` และ `BOT_DISABLED_TEXT` (Task 2) ใช้ใน `engine.config.test.ts`

## ข้อสมมติฐานและความเสี่ยง

- **Upstash ต่อคำสั่ง:** ทุก process ที่รับข้อความจะ `GET` version ≤ 1 ครั้ง/3 วินาที/scope — ปริมาณน้อยมากเทียบกับ rate limit ที่มีอยู่แล้ว
- **Redis ช้า:** `readConfigVersion` ตัดที่ 500ms ต่อครั้ง เกิดไม่เกินทุก 3 วินาที — ไม่ทำให้ reply token (อายุ ~1 นาที) หมด
- **Fake `Date` ใน integration test** (`toFake: ['Date']`): สมมติว่า postgres-js และ `@upstash/redis` ไม่ใช้ `Date` ตัดสิน timeout; ถ้าเทสต์ค้าง ให้เปลี่ยนไปเปิด `vi.useFakeTimers` หลังอุ่น cache แทน
- **`vi.resetModules()`** สร้าง postgres pool ใหม่ต่อ "process จำลอง" — ปิดผ่าน `isolatedDbClosers` ทุกไฟล์
- **Vitest รันไฟล์ขนานกัน:** เทสต์ที่แตะ `chat_settings` / version `settings` รวมไว้ไฟล์เดียว (`settings.integration.test.ts`); ไฟล์อื่น bump แค่ `intents` และ assert เลข version แบบ "มากขึ้น" ไม่ใช่ "+1 พอดี" — dev server ที่รันค้างอยู่และ bump ค่าระหว่างเทสต์อาจทำให้เทสต์ TTL fallback แดงได้ ให้ปิด dev server ตอนรัน integration
- **บอทปิดระหว่าง case-flow:** `botState` ค้างไว้ เมื่อเปิดบอทกลับมาผู้ใช้ทำต่อจากขั้นเดิม — ยอมรับได้ แต่ควรแจ้งเจ้าหน้าที่ใน PR
- **นอกเวลาทำการ** ประชาชนเข้าคิวเจ้าหน้าที่ไม่ได้ (ตั้งใจ) — ถ้าต้องการ "ฝากข้อความไว้ให้เช้า" เป็นงานแยก
- **ชื่อ intent ซ้ำ** ยังได้ 500 เหมือนเดิม (unique violation) — นอกขอบเขต
- **Audit ยังอยู่นอก transaction** ของการเขียน — เป็นเรื่องของการ์ด c6 แยกต่างหาก
