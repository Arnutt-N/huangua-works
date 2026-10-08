# Citizen Case Access (การเข้าถึงเรื่องของประชาชน) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** รวมทุกเส้นทางที่ประชาชนเข้าถึง "เรื่อง" (ติดตามเรื่องทางเว็บ, บอท LINE, "เรื่องของฉัน" ใน LIFF, ถอนความยินยอม, ระบุตัวตนผู้แจ้งตอนแจ้งเรื่องใหม่) ไว้ใน module เดียว `src/lib/cases/citizen-access/` ที่มีกติกาความยินยอมเดียวกันทุกช่องทาง

**Architecture:** module ใหม่มี interface เล็ก 5 ฟังก์ชัน (`resolveCitizen`, `recordIntakeConsent`, `findTrackableCase`, `listMyCases`, `withdrawCaseConsent`) ทุกตัวที่แตะ DB รับ `DbOrTx` — ข้างในซ่อนการสร้าง placeholder email (CID/LINE), การผูก LINE↔users (ON CONFLICT ไม่ catch-ใน-tx), นโยบาย "record ความยินยอมล่าสุดต้องเป็นการให้ความยินยอม" (`ORDER BY created_at DESC, id DESC`), การตัด PII และการเขียน audit เฉพาะการค้นเลขติดตามแบบไม่ล็อกอิน (`listMyCases` ไม่ audit) route/บอท/หน้า LIFF กลายเป็นผู้เรียกบาง ๆ rate limit ยังอยู่ที่ HTTP route แต่เรียก `enforceRateLimit` ของ c7 `withdrawCaseConsent` เป็นเจ้าของ tx แล้วเรียก `revokeConsentWithAudit` ของ c6 เรื่องที่แจ้งผ่านบอทจะบันทึกความยินยอมตอนแจ้ง และมี script backfill ที่รันใน maintenance window

**Tech Stack:** Next.js 16 route handlers + server components, Drizzle ORM + postgres-js (PostgreSQL 17 local docker :5433), Vitest 3 (unit + `*.integration.test.ts` บน Postgres จริง), Playwright (e2e), tsx scripts

**Spec:** `project-log-md/architecture-review/2026-10-03/architecture-review-20261003-205746.html` — การ์ด `id="c1"` ("1 · รวมการเข้าถึง เรื่อง ของประชาชนไว้ใน module เดียว") + การตัดสินใจของผู้ใช้ (binding) ด้านล่างใน Global Constraints

## Global Constraints

- ใช้ `npx` เสมอ (`pnpm` ค้างในเครื่องนี้) — `npx tsc --noEmit`, `npx eslint <ไฟล์ที่แตะ>`, `npx vitest run <file>`, `npx playwright test <spec>` ห้ามอ้าง `npx eslint .` exit 0 (baseline 21 errors / 3 warnings — ดู Task 10)
- Integration test (`*.integration.test.ts`) ต้องมี stack รันอยู่: `docker compose up -d postgres redis up-redis` (Postgres :5433; พอร์ตโฮสต์ของ up-redis มาจาก `UPREDIS_HOST_PORT` ใน `.env` — เครื่องนี้ `8081`; REST URL `http://localhost:8081` อยู่ใน `.env.local` ซึ่ง `vitest.setup.ts` โหลด) และ seed แล้ว (`npx tsx scripts/seed.ts`)
- คอมเมนต์และข้อความถึงผู้ใช้เป็นภาษาไทย; คอมเมนต์ที่ขึ้นต้น `§` ต้องย้ายตามโค้ดไปด้วย ห้ามทิ้ง (แก้ถ้อยคำได้เฉพาะเมื่อพฤติกรรมที่มันอธิบายเปลี่ยนจริง)
- คำศัพท์ตาม `CONTEXT.md`: **เรื่อง**, **แจ้งเรื่องใหม่**, **ติดตามเรื่อง**, **เลขติดตาม**, เบอร์ อบต. **043-601-494**
- `await getDb()` ภายในฟังก์ชันเท่านั้น ห้ามที่ module scope; ฟังก์ชันใน module ที่แตะ DB รับ `db?: DbOrTx` เป็น parameter สุดท้าย (`DbOrTx` จาก `src/lib/db` — `Db | Tx`) ไม่ใช่ `Db` อย่างเดียว เพื่อให้ `createCase` ของ plan `audited-writes` ส่ง `tx` เข้ามาได้ ห้ามเปิด transaction ซ้อนในฟังก์ชันเหล่านี้ (เจ้าของ tx คือผู้เรียก)
- ใช้ `firstOrUndefined()` แทน `.limit(1)` + `[0]`, `generateId()` สำหรับ id, `logAudit(entry, db)` สำหรับ audit
- "ไม่พบ" / "ถอนความยินยอมแล้ว" / "เลขติดตามผิดรูปแบบ" ต้องให้คำตอบเดียวกันทุกช่องทาง (กัน enumeration) — เว็บ 404 `{ error: 'ไม่พบเรื่องนี้' }`, บอทข้อความ "ไม่พบเรื่องเลข …"
- **กติกาความยินยอม (binding):** ประชาชนเห็นเรื่องได้ก็ต่อเมื่อ record `data_collection` ล่าสุดของเจ้าของเรื่องเป็น `is_granted = true` — ไม่มี record เลย = มองไม่เห็น — ใช้กับ **ทุกช่องทาง** รวมบอทและ "เรื่องของฉัน" ใน LIFF
- **ความยินยอมของบอท (binding):** แจ้งเรื่องผ่านแชทบอท = ให้ความยินยอม (`via: 'line_bot_submit'`) โดยต้องมีข้อความแจ้งในสรุปก่อนผู้ใช้พิมพ์ "ยืนยัน"; ผู้แจ้งผ่านบอทรุ่นเก่าที่ไม่มี record เลย ได้รับ record ผ่าน script backfill (dry-run เป็นค่าเริ่มต้น, `--apply` เพื่อเขียน)
- Rate limit อยู่ที่ HTTP route เท่านั้น (`rate:track:<ip>` 10/300s fail-open, `rate:consent-withdraw:<ip>` 5/600s `failOpen: false`) — ไม่ย้ายเข้า module, ไม่เปลี่ยนค่า
- ไม่มี schema migration ในแผนนี้
- Conventional commits, `git add <ไฟล์ที่ระบุ>` เท่านั้น (ห้าม `git add .` — working tree มีไฟล์ untracked ของ tooling อยู่); ไม่ใส่ attribution trailer (ผู้ใช้ปิด attribution ไว้ global)
- ไฟล์ไม่เกิน ~400 บรรทัด, ฟังก์ชันไม่เกิน 50 บรรทัด
- e2e ที่ต้องเขียวตลอด: `e2e/track.spec.ts`, `e2e/track-liff.spec.ts`, `e2e/intake-liff.spec.ts`
- **ชนกับ plan `conversation-module` (c4):** แผนนั้นแก้ `src/lib/line/bot/engine.ts` (ย้ายเข้า module) และ `engine.test.ts` ด้วย — ก่อนเริ่ม Task 7 ให้ `git fetch origin && git log origin/main --oneline -- src/lib/line/bot/engine.ts` ถ้ามี commit จากแผนนั้นใน main แล้ว ให้ rebase แล้วอ่านไฟล์ใหม่ทั้งไฟล์ ปรับ step ให้ตรงโค้ดจริงโดยคงทั้งสองการเปลี่ยนแปลงไว้; ถ้าทำคู่ขนาน คน merge ทีหลังเป็นฝ่าย rebase
- **ชนกับ plan `audited-writes` (c6) — semantic ไม่ใช่แค่ hunk:**
  - ฟังก์ชัน module ทุกตัวที่แตะ DB รับ `DbOrTx` ตั้งแต่ต้น (constraint ด้านบน) `createCase` ของ c6 ห่อ transaction แล้วเรียก `resolveCitizen(identity, tx)` + `recordIntakeConsent(..., tx)` — ห้ามเรียกนอก tx
  - `insertUserOrReuse` / `linkLineRow` ห้าม catch-unique-แล้ว-select ใน transaction (statement error ทำให้ทั้ง tx abort) — ใช้ `INSERT ... ON CONFLICT ... RETURNING` แล้ว `SELECT` ในคำสั่งเดียวกันตาม snippet Task 1; c6 ต้องใช้ snippet เดียวกัน ห้ามแค่เปลี่ยน type
  - `withdrawCaseConsent` เป็นเจ้าของ tx เอง แล้วเรียก helper `revokeConsentWithAudit` (อยู่ใน `src/lib/consent.ts` ของ c6) **ภายใน tx เดียวกัน** ห้ามเรียก `withdrawConsent` ของ c6 ซึ่งเปิด tx เอง (จะซ้อน) และห้ามเรียก `revokeConsent` + `logAudit` แยก statement
  - ไฟล์ `src/lib/cases/intake.integration.test.ts`: **c6 เป็นเจ้าของไฟล์** (โครง + rollback tests รวม `channel=line`) แผนนี้ต่อท้ายเฉพาะ test consent/visibility — ห้าม `สร้าง` ไฟล์ซ้ำ ถ้า c6 ยังไม่ merge ให้สร้างโครงขั้นต่ำตาม Task 3 แล้วตอน rebase รวมของ c6 เข้ามา ไม่ทับ
- **ชนกับ plan `rate-limit-policies` (c7):** Task 6 (`cases/[id]/route.ts`) และ Task 8 (`consent/withdraw/route.ts`) เขียนทั้งไฟล์ — **c7 merge ก่อนเสมอ** snippet เรียก `enforceRateLimit` + `clientIpFromHeaders` ตาม signature จริงของ c7 ไม่ใช่ `checkRateLimit` ตรง ๆ (เขียนทั้งไฟล์จะ revert นโยบายของ c7 โดยไม่มี conflict) ถ้าต้องทำแผนนี้เดี่ยวก่อน c7 merge ใช้ fallback บรรทัดเดียวใน snippet นั้น แล้วสลับเป็น `enforceRateLimit` ทันทีที่ rebase บน c7
- **ชนกับ plan `bot-config-module` (c5):** c5 แก้ `src/lib/line/bot/engine.ts` + `engine.test.ts` ด้วย (import block + `routeBotMessage(..., now)` + เช็ก `bot_enabled`) ทับช่วงเดียวกับ Task 7 — ก่อน Task 7 ให้ `git log origin/main --oneline -- src/lib/line/bot/engine.ts` ถ้ามี commit ของ c5 แล้ว อ่านไฟล์ใหม่ทั้งไฟล์ คง `now` / `bot_enabled` / transport ของ c4 ไว้ และยังเรียก `findTrackableCase(..., { channel: 'line_bot' }, db)` ลำดับที่ลดการรื้อ: c7 ก่อนแผนนี้, c6 ประกอบกับแผนนี้, c5 หลัง c4+แผนนี้

---

## File Structure

| ไฟล์ | สถานะ | หน้าที่ |
|---|---|---|
| `src/lib/cases/citizen-access/index.ts` | Create | interface สาธารณะของ module (re-export เท่านั้น) |
| `src/lib/cases/citizen-access/identity.ts` | Create | `resolveCitizen` — CID/LINE → `users.id`, ผูก `line_users.linked_user_id`, placeholder email ของ CID (`cidPlaceholderEmail` ใช้ภายใน module เท่านั้น) |
| `src/lib/cases/citizen-access/consent-policy.ts` | Create | `recordIntakeConsent` + `consentActiveFor` (SQL ของกติกาความยินยอม — ภายใน module) |
| `src/lib/cases/citizen-access/view.ts` | Create | `findTrackableCase` (ตัด PII + audit) และ `listMyCases` |
| `src/lib/cases/citizen-access/withdraw.ts` | Create | `withdrawCaseConsent` — พิสูจน์ความเป็นเจ้าของ 2 แบบ (CID / LINE) + revoke + audit |
| `src/lib/cases/citizen-access/identity.integration.test.ts` | Create | test ที่ interface: ตัวตน |
| `src/lib/cases/citizen-access/view.integration.test.ts` | Create | test ที่ interface: การมองเห็น/ตัด PII/audit/เรื่องของฉัน |
| `src/lib/cases/citizen-access/withdraw.integration.test.ts` | Create | test ที่ interface: ถอนความยินยอม |
| `src/lib/cases/intake.integration.test.ts` | Modify (c6 เป็นเจ้าของไฟล์ — แผนนี้ต่อท้าย test เท่านั้น ห้ามสร้างซ้ำ) | createCase บันทึกความยินยอมทุกช่องทาง + เรื่องจากบอทติดตามได้ |
| `src/lib/cases/intake.ts` | Modify | ลบ `resolveSubmitter`, เรียก `resolveCitizen` + `recordIntakeConsent` |
| `src/lib/cases/intake.test.ts` | Modify | ลบ describe ตัวตนเว็บ (ย้ายไป integration test ของ module) |
| `src/app/api/liff/session/route.ts` | Modify | ลบ `linkLineIdentity`, เรียก `resolveCitizen` |
| `src/app/api/cases/[id]/route.ts` | Modify | เหลือ rate limit + เรียก `findTrackableCase` |
| `src/app/track/page.tsx` | Modify | `getMyCases` → `listMyCases` |
| `src/lib/cases/my-cases.ts`, `src/lib/cases/my-cases.test.ts` | Delete | แทนด้วย `listMyCases` + integration test |
| `src/lib/line/bot/engine.ts` | Modify | `trackCase` เรียก `findTrackableCase` |
| `src/lib/line/bot/engine.test.ts` | Modify | mock `@/lib/cases/citizen-access` + test ใหม่ |
| `src/lib/line/bot/case-flow.ts` | Modify | `BOT_CONSENT_NOTICE` ในสรุปก่อนยืนยัน |
| `src/lib/line/bot/case-flow.test.ts` | Modify | test ข้อความแจ้งความยินยอม |
| `src/app/api/consent/withdraw/route.ts` | Modify | เหลือ rate limit + parse + เรียก `withdrawCaseConsent` |
| `src/app/api/cases/submit/route.integration.test.ts` | Modify | cleanup consent records ของ LINE dedup user |
| `e2e/track-liff.spec.ts` | Modify | seed consent record (ตามกติกาใหม่) |
| `scripts/backfill-bot-consent.ts` | Create | backfill ความยินยอมให้ผู้แจ้งผ่านบอทรุ่นเก่า |

---

### Task 0: แตก branch

**Files:** ไม่มี

- [ ] **Step 1: ตรวจ working tree ก่อนสลับ branch**

Run: `git status --short`
Expected: เห็นไฟล์ modified (`.gitignore`, `AGENTS.md`, `next-env.d.ts`) และ untracked ของ tooling — ถ้า `git checkout main` ในขั้นถัดไปปฏิเสธเพราะไฟล์ modified จะถูกเขียนทับ **ให้หยุดและถามผู้ใช้** (ห้าม stash/discard เอง)

- [ ] **Step 2: แตก branch จาก main**

```bash
git checkout main && git pull && git checkout -b refactor/citizen-case-access
```

Expected: `Switched to a new branch 'refactor/citizen-case-access'`

- [ ] **Step 3: ยก stack สำหรับ integration test**

```bash
docker compose up -d postgres redis up-redis
npx drizzle-kit push
npx tsx scripts/seed.ts
```

Expected: container ทั้งสาม `Running`/`Healthy`; seed จบโดยไม่มี error

---

### Task 1: `resolveCitizen` — ตัวตนประชาชนจุดเดียว

**Files:**
- Create: `src/lib/cases/citizen-access/identity.ts`
- Create: `src/lib/cases/citizen-access/index.ts`
- Test: `src/lib/cases/citizen-access/identity.integration.test.ts`

**Interfaces:**
- Consumes: `generateCidHash(cid: string): string` (`src/lib/cid-hmac.ts`), `linePlaceholderEmail(localPart: string): string` (`src/lib/line/placeholder-email.ts`)
- Produces:
  - `type CitizenIdentity = { kind: 'cid'; cid: string; fullName?: string; phoneNumber?: string; contactEmail?: string } | { kind: 'line'; lineUserId: string; fullName?: string; profile?: { displayName?: string; pictureUrl?: string }; source: 'line_intake' | 'liff_session' }`
  - `resolveCitizen(identity: CitizenIdentity, db?: DbOrTx): Promise<string>` — คืน `users.id` (`DbOrTx` จาก `src/lib/db`)
  - (ภายใน module) `cidPlaceholderEmail(cid: string): string`

- [ ] **Step 1: เขียน failing test**

สร้าง `src/lib/cases/citizen-access/identity.integration.test.ts`:

```ts
import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { lineUsers, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { resolveCitizen } from './index';

/**
 * resolveCitizen — ตัวตนของประชาชนจุดเดียว (แทน resolveSubmitter ใน intake.ts และ
 * linkLineIdentity ใน /api/liff/session) รันกับ Postgres จริง:
 *   docker compose up -d postgres redis up-redis
 */

const RUN = Date.now();
const CID = `it-ca-cid-${RUN}`;
const OTHER_CID = `it-ca-cid-other-${RUN}`;
const LINE_NEW = `U-it-ca-new-${RUN}`;
const LINE_LINKED = `U-it-ca-linked-${RUN}`;
const LINE_RACE = `U-it-ca-race-${RUN}`;
const STAFF_EMAIL = `it-ca-staff-${RUN}@placeholder.local`;

const createdUserIds = new Set<string>();
const createdLineIds = [LINE_NEW, LINE_LINKED, LINE_RACE];

function track(id: string): string {
  createdUserIds.add(id);
  return id;
}

/** users.metadata ถูกเขียนด้วย JSON.stringify (คงพฤติกรรมเดิม) — อ่านกลับได้ทั้งสองแบบ */
function parseMeta(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') return JSON.parse(value) as Record<string, unknown>;
  return (value ?? {}) as Record<string, unknown>;
}

afterAll(async () => {
  const db = await getDb();
  await db.delete(lineUsers).where(inArray(lineUsers.lineUserId, createdLineIds));
  if (createdUserIds.size > 0) {
    await db.delete(users).where(inArray(users.id, [...createdUserIds]));
  }
  await closeDb();
});

describe('resolveCitizen · ผู้แจ้งทางเว็บ (CID)', () => {
  test('CID เดิม → user เดิม, CID ต่างกัน → user คนละคน', async () => {
    const first = track(await resolveCitizen({ kind: 'cid', cid: CID, fullName: 'สมชาย ทดสอบ' }));
    const again = await resolveCitizen({ kind: 'cid', cid: CID });
    const other = track(await resolveCitizen({ kind: 'cid', cid: OTHER_CID }));

    expect(again).toBe(first);
    expect(other).not.toBe(first);
  });

  test('§ email ที่กรอกไม่ใช่ identity — ไม่ผูกกับบัญชีที่มี email นั้นอยู่แล้ว แต่เก็บเป็นช่องทางติดต่อ', async () => {
    const db = await getDb();
    const staffId = track(generateId());
    await db.insert(users).values({
      id: staffId,
      email: STAFF_EMAIL,
      role: 'officer',
      isActive: true,
      fullName: 'เจ้าหน้าที่ทดสอบ',
    });

    const citizenId = track(
      await resolveCitizen({ kind: 'cid', cid: `${CID}-contact`, contactEmail: STAFF_EMAIL }),
    );

    expect(citizenId).not.toBe(staffId);
    const [row] = await db.select().from(users).where(eq(users.id, citizenId)).limit(1);
    expect(row?.role).toBe('citizen');
    expect(row?.email).not.toBe(STAFF_EMAIL);
    expect(parseMeta(row?.metadata)).toMatchObject({ source: 'web_intake', contactEmail: STAFF_EMAIL });
  });
});

describe('resolveCitizen · ผู้ใช้ LINE', () => {
  test('LINE ใหม่ → สร้าง users + line_users ที่ผูกกัน และเรียกซ้ำได้ id เดิม', async () => {
    const db = await getDb();
    const first = track(
      await resolveCitizen({ kind: 'line', lineUserId: LINE_NEW, source: 'line_intake' }),
    );
    const again = await resolveCitizen({ kind: 'line', lineUserId: LINE_NEW, source: 'line_intake' });

    expect(again).toBe(first);
    const [lineRow] = await db.select().from(lineUsers).where(eq(lineUsers.lineUserId, LINE_NEW)).limit(1);
    expect(lineRow?.linkedUserId).toBe(first);
    const [userRow] = await db.select().from(users).where(eq(users.id, first)).limit(1);
    expect(userRow?.fullName).toBe('ผู้ใช้ LINE');
  });

  test('line_users ที่ผูกแล้ว → คืน linkedUserId เดิม และอัปเดตโปรไฟล์ที่ส่งมา', async () => {
    const db = await getDb();
    const ownerId = track(generateId());
    await db.insert(users).values({
      id: ownerId,
      email: `it-ca-linked-owner-${RUN}@placeholder.local`,
      role: 'citizen',
      isActive: true,
      fullName: 'เจ้าของเดิม',
    });
    await db.insert(lineUsers).values({
      id: generateId(),
      lineUserId: LINE_LINKED,
      displayName: 'ชื่อเก่า',
      linkedUserId: ownerId,
    });

    const resolved = await resolveCitizen({
      kind: 'line',
      lineUserId: LINE_LINKED,
      fullName: 'ชื่อใหม่',
      profile: { displayName: 'ชื่อใหม่', pictureUrl: 'https://profile.line-scdn.net/it-ca' },
      source: 'liff_session',
    });

    expect(resolved).toBe(ownerId);
    const [lineRow] = await db.select().from(lineUsers).where(eq(lineUsers.lineUserId, LINE_LINKED)).limit(1);
    expect(lineRow?.displayName).toBe('ชื่อใหม่');
    expect(lineRow?.pictureUrl).toBe('https://profile.line-scdn.net/it-ca');
  });

  test('§ เรียกพร้อมกันสองครั้ง (login สอง tab) → ได้ user เดียว ไม่พังที่ unique index', async () => {
    const [a, b] = await Promise.all([
      resolveCitizen({ kind: 'line', lineUserId: LINE_RACE, source: 'liff_session' }),
      resolveCitizen({ kind: 'line', lineUserId: LINE_RACE, source: 'liff_session' }),
    ]);
    track(a);
    track(b);

    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npx vitest run src/lib/cases/citizen-access/identity.integration.test.ts`
Expected: FAIL — `Failed to resolve import "./index"` (ยังไม่มีไฟล์)

- [ ] **Step 3: เขียน `identity.ts`**

สร้าง `src/lib/cases/citizen-access/identity.ts`:

```ts
import { eq } from 'drizzle-orm';
import { getDb, type DbOrTx } from '../../db';
import { firstOrUndefined } from '../../db/query-helpers';
import { lineUsers, users } from '../../db/schema';
import { generateId } from '../../id';
import { generateCidHash } from '../../cid-hmac';
import { linePlaceholderEmail } from '../../line/placeholder-email';

/**
 * ตัวตนของประชาชนที่ระบบรับรู้ได้ — เว็บผูกกับ CID เท่านั้น, LINE ผูกกับ lineUserId
 * ที่ผ่านการ verify แล้ว (webhook signature / LIFF HMAC session cookie)
 */
export type CitizenIdentity =
  | {
      kind: 'cid';
      cid: string;
      fullName?: string;
      phoneNumber?: string;
      /** email ที่ประชาชนกรอก — เก็บเป็นช่องทางติดต่อเท่านั้น ไม่ใช่ identity key */
      contactEmail?: string;
    }
  | {
      kind: 'line';
      lineUserId: string;
      /** ใช้ตั้ง users.full_name ตอนสร้างแถวใหม่เท่านั้น */
      fullName?: string;
      /** โปรไฟล์ LINE ล่าสุด (จาก ID token) — เขียนทับ line_users เมื่อส่งมา */
      profile?: { displayName?: string; pictureUrl?: string };
      source: 'line_intake' | 'liff_session';
    };

type CidIdentity = Extract<CitizenIdentity, { kind: 'cid' }>;
type LineIdentity = Extract<CitizenIdentity, { kind: 'line' }>;

/**
 * placeholder email ของผู้แจ้งทางเว็บ — ใช้ภายใน module เท่านั้น (identity + withdraw)
 * § เดิมเขียนมือสองที่ (intake.ts กับ consent/withdraw) ถ้าเปลี่ยนที่เดียว withdraw จะพังเงียบ ๆ
 */
export function cidPlaceholderEmail(cid: string): string {
  return `cid-${generateCidHash(cid)}@placeholder.local`;
}

/** คืน users.id ของประชาชน — สร้างแถว users / ผูก line_users ให้ถ้ายังไม่มี */
export async function resolveCitizen(identity: CitizenIdentity, db?: DbOrTx): Promise<string> {
  const _db = db ?? (await getDb());
  return identity.kind === 'cid'
    ? resolveCidCitizen(_db, identity)
    : resolveLineCitizen(_db, identity);
}

async function findUserIdByEmail(db: DbOrTx, email: string): Promise<string | undefined> {
  const row = await firstOrUndefined(
    db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1),
  );
  return row?.id;
}

/**
 * insert users แบบทน race — แพ้ unique(users.email) แล้วใช้แถวของ request ที่ชนะ
 *
 * § ห้าม catch-unique-แล้ว-select: createCase (audited-writes) เรียกฟังก์ชันนี้ใน
 * transaction ถ้า statement error ทั้ง tx abort แล้ว select ต่อไม่ได้
 * ON CONFLICT DO NOTHING ไม่ error; RETURNING ว่าง = แพ้ race → SELECT ในคำสั่งเดียวกัน
 * target คือ unique(users.email) (`schema.ts` column `.unique()`)
 */
async function insertUserOrReuse(db: DbOrTx, row: typeof users.$inferInsert): Promise<string> {
  const inserted = await db
    .insert(users)
    .values(row)
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });
  return inserted[0]?.id ?? (await findUserIdByEmail(db, row.email)) ?? row.id;
}

async function resolveCidCitizen(db: DbOrTx, identity: CidIdentity): Promise<string> {
  // § ตัวตนของผู้แจ้งทางเว็บผูกกับ CID เท่านั้น — ห้ามใช้ email ที่กรอกเป็น lookup key
  // เดิมใช้ `input.email || cid-hash` ซึ่งเปิดให้ใครก็ได้ยิง /api/cases/submit พร้อม email
  // ของเจ้าหน้าที่ แล้วเคส + consent record ไปผูกกับบัญชีคนนั้นทั้งที่เขาไม่เคยยินยอม
  // (endpoint นี้ไม่ต้อง login — email ที่ส่งมาไม่เคยถูกยืนยัน จึงเป็น identity ไม่ได้)
  //
  // ผลพลอยได้: เดิมคนที่กรอก email จริงจะถอนความยินยอมไม่ได้เลย เพราะ withdraw
  // เทียบกับ placeholder ของ CID เท่านั้น — ผูกทุกคนด้วย CID hash เหมือนกันหมดแล้ว
  const email = cidPlaceholderEmail(identity.cid);
  const existing = await findUserIdByEmail(db, email);
  if (existing) return existing;

  return insertUserOrReuse(db, {
    id: generateId(),
    email,
    role: 'citizen',
    isActive: true,
    fullName: identity.fullName || 'ประชาชน',
    phoneNumber: identity.phoneNumber || null,
    // § email ที่ประชาชนกรอกเก็บเป็น "ช่องทางติดต่อ" ใน metadata ไม่ใช่ identity key
    metadata: JSON.stringify({
      source: 'web_intake',
      ...(identity.contactEmail ? { contactEmail: identity.contactEmail } : {}),
    }),
  });
}

async function resolveLineCitizen(db: DbOrTx, identity: LineIdentity): Promise<string> {
  // § เจ้าของความสัมพันธ์ line↔users จุดเดียวของระบบ — เดิมมีสองตัว (resolveSubmitter
  // ใน intake + linkLineIdentity ใน liff/session) ที่ทำต่างกันเล็กน้อย: ตัวหนึ่งไม่สร้าง
  // line_users ตัวหนึ่งกัน race ตัวหนึ่งไม่กัน — แจ้งผ่านบอทครั้งที่ 2 เคยชน unique(users.email)
  // และ "เรื่องของฉัน" (LIFF) มองไม่เห็นเคสของบอท
  const lineRow = await firstOrUndefined(
    db
      .select({ id: lineUsers.id, linkedUserId: lineUsers.linkedUserId })
      .from(lineUsers)
      .where(eq(lineUsers.lineUserId, identity.lineUserId))
      .limit(1),
  );

  // reuse row เดิมก่อนสร้างใหม่เสมอ — กันชน unique(users.email) จากการแจ้ง/login ซ้ำ
  let userId = lineRow?.linkedUserId ?? undefined;
  if (!userId) {
    const email = linePlaceholderEmail(identity.lineUserId);
    userId =
      (await findUserIdByEmail(db, email)) ??
      (await insertUserOrReuse(db, {
        id: generateId(),
        email,
        role: 'citizen',
        isActive: true,
        fullName: identity.fullName || 'ผู้ใช้ LINE',
        metadata: JSON.stringify({ source: identity.source }),
      }));
  }

  await linkLineRow(db, identity, lineRow, userId);
  return userId;
}

async function linkLineRow(
  db: DbOrTx,
  identity: LineIdentity,
  lineRow: { id: string; linkedUserId: string | null } | undefined,
  userId: string,
): Promise<void> {
  const profile = identity.profile ?? {};
  const profilePatch = {
    ...(profile.displayName ? { displayName: profile.displayName } : {}),
    ...(profile.pictureUrl ? { pictureUrl: profile.pictureUrl } : {}),
  };

  if (lineRow) {
    const needsWrite = lineRow.linkedUserId !== userId || Object.keys(profilePatch).length > 0;
    if (!needsWrite) return;
    await db
      .update(lineUsers)
      .set({ linkedUserId: userId, ...profilePatch, updatedAt: new Date() })
      .where(eq(lineUsers.id, lineRow.id));
    return;
  }

  // § unique(line_users.line_user_id) แพ้ race — ON CONFLICT แล้วเขียน link ในคำสั่งเดียวกัน
  // ห้าม catch แล้ว update: ใน transaction ของ createCase statement error ทำให้ทั้ง tx abort
  // target คือ uniqueIndex('line_users_line_user_id_idx')
  await db
    .insert(lineUsers)
    .values({
      id: generateId(),
      lineUserId: identity.lineUserId,
      displayName: profile.displayName ?? null,
      pictureUrl: profile.pictureUrl ?? null,
      linkedUserId: userId,
      metadata: { profileCheckedAt: new Date().toISOString() },
    })
    .onConflictDoUpdate({
      target: lineUsers.lineUserId,
      set: { linkedUserId: userId, updatedAt: new Date() },
    });
}
```

- [ ] **Step 4: เขียน `index.ts`**

สร้าง `src/lib/cases/citizen-access/index.ts`:

```ts
/**
 * citizen-access — การเข้าถึง "เรื่อง" ของประชาชนทุกช่องทาง (เว็บ / บอท LINE / LIFF)
 * ผ่าน interface เดียว
 *
 * ข้างในรวม: ระบุตัวตนเจ้าของเรื่อง (CID / LINE), นโยบายความยินยอม, ตัด PII ก่อนแสดง,
 * audit การเข้าดูและการถอนความยินยอม — route / บอท / หน้า LIFF เป็นแค่ผู้เรียก
 * § ห้าม query cases ฝั่งประชาชนเองนอก module นี้ (เดิมสามช่องทางเช็คความยินยอมไม่เท่ากัน
 * บอทแสดงหัวเรื่องของเรื่องที่เจ้าของถอนความยินยอมแล้วได้)
 */
export { resolveCitizen, type CitizenIdentity } from './identity';
```

- [ ] **Step 5: รัน test ให้ผ่าน**

Run: `npx vitest run src/lib/cases/citizen-access/identity.integration.test.ts`
Expected: PASS 5 tests

- [ ] **Step 6: Typecheck + lint ไฟล์ใหม่**

Run: `npx tsc --noEmit && npx eslint src/lib/cases/citizen-access`
Expected: ไม่มี output (exit 0)

- [ ] **Step 7: Commit**

```bash
git add src/lib/cases/citizen-access/identity.ts src/lib/cases/citizen-access/index.ts src/lib/cases/citizen-access/identity.integration.test.ts
git commit -m "refactor(citizen-access): add resolveCitizen as the single citizen identity resolver"
```

---

### Task 2: ต่อ `resolveCitizen` เข้า intake และ LIFF session

**Files:**
- Modify: `src/lib/cases/intake.ts:1-12` (imports), `:85-88` (resolve submitter), `:169-253` (ลบ `Db` alias + `resolveSubmitter`)
- Modify: `src/app/api/liff/session/route.ts:1-104` (imports + ลบ `linkLineIdentity`), `:132`
- Modify: `src/lib/cases/intake.test.ts:4-13` (header), `:130` (import `generateCidHash` — บรรทัด 142 คือฟิลด์ `fullName` ใน `webInput` ห้ามลบตามเลขเก่า), `:209-260` (ลบ describe)

**Interfaces:**
- Consumes: `resolveCitizen(identity: CitizenIdentity, db?: DbOrTx): Promise<string>`, `type CitizenIdentity` จาก `./citizen-access` (Task 1)
- Produces: ไม่มี interface ใหม่ — `createCase` และ `POST /api/liff/session` พฤติกรรมเดิม

> refactor ล้วน: safety net คือ test เดิม (`intake.test.ts` ส่วน collision loop, `case-flow.test.ts`, `submit/route.integration.test.ts`) + Task 1 — ไม่มี RED ใหม่

- [ ] **Step 1: แก้ imports ของ `intake.ts`**

แทนบรรทัด 1–12 ของ `src/lib/cases/intake.ts` ด้วย:

```ts
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { firstOrUndefined } from '../db/query-helpers';
import { cases, categories } from '../db/schema';
import { generateId } from '../id';
import { generateTrackingCode } from '../case-tracking';
import { checkDuplicate, recordDedupHash } from '../dedup';
import { grantConsent, CONSENT_VERSION } from '../consent';
import { AUDIT_ACTIONS, logAudit } from '../audit';
import { getFiscalYear } from '../thai-date';
import { resolveCitizen, type CitizenIdentity } from './citizen-access';
```

- [ ] **Step 2: แทนการเรียก `resolveSubmitter`**

ใน `createCase` แทน

```ts
  const submitterId = await resolveSubmitter(db, input);
  if (!submitterId) {
    return { ok: false, error: 'ไม่สามารถสร้างผู้ใช้งานได้', errorCode: 'internal' };
  }
```

ด้วย

```ts
  const identity = citizenIdentityOf(input);
  if (!identity) {
    return { ok: false, error: 'ไม่สามารถสร้างผู้ใช้งานได้', errorCode: 'internal' };
  }
  const submitterId = await resolveCitizen(identity, db);
```

- [ ] **Step 3: ลบ `resolveSubmitter` แล้วเพิ่ม `citizenIdentityOf`**

ลบตั้งแต่ `type Db = Awaited<ReturnType<typeof getDb>>;` (บรรทัด 169) ถึงท้ายไฟล์ (คอมเมนต์ § ของทั้งสองสาขาถูกย้ายไปอยู่ใน `identity.ts` แล้วใน Task 1) แล้วต่อท้ายไฟล์ด้วย:

```ts
/**
 * แปลง input ของการแจ้งเรื่องใหม่ → ตัวตนที่ citizen-access เข้าใจ
 * เว็บผูกกับ CID / ช่องทาง LINE (บอท + LIFF) ผูกกับ lineUserId ที่ verify แล้ว
 *
 * § ขาด key (เว็บไม่มี cid / line ไม่มี lineUserId) ไม่เกิดจาก flow จริง (zod + session
 * บังคับไว้แล้ว) — เดิมสาย line สร้าง user ลอยไม่ผูก link ซึ่งทำให้เรื่องนั้นไม่มีเจ้าของ
 * ที่ติดตาม/ถอนความยินยอมได้ ตอนนี้ตอบ internal แทน
 */
function citizenIdentityOf(input: CaseIntakeInput): CitizenIdentity | null {
  if (input.channel === 'line') {
    return input.lineUserId
      ? { kind: 'line', lineUserId: input.lineUserId, fullName: input.fullName, source: 'line_intake' }
      : null;
  }
  return input.cid
    ? {
        kind: 'cid',
        cid: input.cid,
        fullName: input.fullName,
        phoneNumber: input.phoneNumber,
        contactEmail: input.email,
      }
    : null;
}
```

- [ ] **Step 4: ทำ LIFF session route ให้บาง**

ใน `src/app/api/liff/session/route.ts` แทนบรรทัด 1–17 (imports) ด้วย:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit/enforce';
import { clientIpFromHeaders } from '@/lib/rate-limit/client-ip';
import { parseBody } from '@/lib/api-helpers';
import { liffSessionSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { resolveCitizen } from '@/lib/cases/citizen-access';
import { verifyLineIdToken, type VerifiedLineIdentity } from '@/lib/liff/verify-line-id-token';
import {
  LIFF_SESSION_COOKIE,
  LIFF_SESSION_TTL_SECONDS,
  createLiffSessionValue,
  readLiffSessionValue,
} from '@/lib/liff/session';
```

ลบทั้งบล็อก JSDoc + `async function linkLineIdentity(...) { ... }` (บรรทัด 27–104 เดิม)

ช่วง rate limit (`:107-113` เดิม) ต้องเป็นของ c7 ไม่ใช่ `checkRateLimit` ตรง ๆ (c7 merge ก่อนเสมอ — เขียน import ใหม่ทับ `:7` ได้):

```ts
  const ip = clientIpFromHeaders(req.headers);

  // § failOpen: false — path นี้คือการยืนยันตัวตน Redis ล่มต้องปิด กัน brute ไม่จำกัด
  // (บังคับที่ RATE_LIMIT_POLICIES.liffSession — kind 'auth')
  // ทำ c1 เดี่ยวชั่วคราว: const rateLimit = await checkRateLimit(`rate:liff-session:${ip}`, 5, 300, { failOpen: false });
  const rateLimit = await enforceRateLimit('liffSession', ip);
```

แล้วแทน `const userId = await linkLineIdentity(identity);` ด้วย:

```ts
  // § การผูก line↔users อยู่ที่ citizen-access จุดเดียว (เดิม linkLineIdentity ที่นี่
  // กับ resolveSubmitter ใน intake ทำซ้ำกันคนละแบบ)
  const userId = await resolveCitizen({
    kind: 'line',
    lineUserId: identity.lineUserId,
    fullName: identity.displayName,
    profile: { displayName: identity.displayName, pictureUrl: identity.pictureUrl },
    source: 'liff_session',
  });
```

- [ ] **Step 5: ตัด test ตัวตนเว็บที่ซ้ำซ้อนออกจาก `intake.test.ts`**

ลบ describe `'createCase · ตัวตนผู้แจ้งทางเว็บผูกกับ CID เท่านั้น'` ทั้งบล็อก (บรรทัด 209–260) และลบบรรทัด `const { generateCidHash } = await import('@/lib/cid-hmac');` (บรรทัด 130 — ตรวจไฟล์ก่อนลบ อย่าใช้เลข 142)

แทนบรรทัด 10–12 ของ header comment:

```ts
 * 2. ตัวตนของผู้แจ้งทางเว็บผูกกับ HMAC ของ CID เท่านั้น
 *    เดิมใช้ `input.email || cid-hash` ทำให้ยิง email ของเจ้าหน้าที่เข้ามาแล้วเคส
 *    ไปผูกกับบัญชีคนนั้นได้ ทั้งที่ endpoint ไม่ต้อง login
```

ด้วย

```ts
 * 2. (ย้ายแล้ว) ตัวตนผู้แจ้งทางเว็บผูกกับ CID เท่านั้น — ทดสอบที่ interface ของ module
 *    กับ Postgres จริงใน src/lib/cases/citizen-access/identity.integration.test.ts
```

- [ ] **Step 6: รัน safety net**

Run: `npx vitest run src/lib/cases/intake.test.ts src/lib/line/bot/case-flow.test.ts src/app/api/cases/submit/route.integration.test.ts src/lib/cases/citizen-access`
Expected: PASS ทั้งหมด (intake.test เหลือ 8 test cases ของ collision loop: `it(` 4 จุด + `it.each` 4 เคส — ห้ามนับเป็น 4 tests; ไฟล์เต็มก่อนลบ describe คือ 14 test cases ห้ามแก้ตัวเลข 14)

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/lib/cases src/app/api/liff`
Expected: exit 0 (ไม่มี unused import)

- [ ] **Step 8: Commit**

```bash
git add src/lib/cases/intake.ts src/lib/cases/intake.test.ts src/app/api/liff/session/route.ts
git commit -m "refactor(citizen-access): route intake and LIFF session through resolveCitizen"
```

---

### Task 3: บันทึกความยินยอมตอนแจ้งเรื่องทุกช่องทาง (รวมบอท)

**Files:**
- Create: `src/lib/cases/citizen-access/consent-policy.ts`
- Modify: `src/lib/cases/citizen-access/index.ts`
- Modify: `src/lib/cases/intake.ts` (imports + บล็อก `grantConsent` บรรทัด ~90–101 เดิม)
- Modify: `src/app/api/cases/submit/route.integration.test.ts:57-61` (cleanup)
- Modify: `src/lib/cases/intake.integration.test.ts` (c6 สร้างโครง + rollback tests; แผนนี้ต่อท้าย describe consent/visibility — ห้ามสร้างไฟล์ซ้ำ)

**Interfaces:**
- Consumes: `grantConsent(grant: ConsentGrant, db?: DbOrTx): Promise<void>`, `CONSENT_VERSION` (`src/lib/consent.ts` — c6 ขยาย `db?` เป็น `DbOrTx` แล้ว; ถ้ายังเป็น `Db` ให้ขยายใน Task นี้ก่อน ไม่งั้นส่ง `tx` ไม่ได้)
- Produces:
  - `type IntakeConsentVia = 'intake_submit' | 'liff_submit' | 'line_bot_submit'`
  - `recordIntakeConsent(userId: string, via: IntakeConsentVia, ctx?: { ipAddress?: string; userAgent?: string }, db?: DbOrTx): Promise<void>`

- [ ] **Step 1: เขียน failing test (ต่อท้ายไฟล์ของ c6 — ห้ามสร้างไฟล์ซ้ำ)**

`src/lib/cases/intake.integration.test.ts` เป็นของ plan `audited-writes` (โครง + rollback tests รวม `channel=line`) ถ้าไฟล์ยังไม่มีเพราะ c6 ยังไม่ merge ให้สร้างโครงขั้นต่ำด้านล่าง แล้วตอน rebase **รวม** describe ของ c6 เข้ามา ห้ามทับไฟล์ฝ่ายนั้น

ถ้าไฟล์ของ c6 มีอยู่แล้ว: อย่าเขียน `afterAll`/`beforeAll` ซ้ำ — ใช้ namespace ของ fixture (`title` มี `RUN`, `lineUserId` ขึ้นต้น `U-it-intake-`) แล้วเพิ่มเฉพาะ describe นี้ท้ายไฟล์ cleanup ของ RED ที่ expect throw ต้องลบด้วย title/owner ของ fixture ไม่พึ่ง `caseIds` ที่ push หลังสำเร็จ (กติกา C6-03 ของ c6)

เพิ่มท้าย `src/lib/cases/intake.integration.test.ts`:

```ts
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { auditLogs, cases, categories, consentRecords, dedupHashes, lineUsers, users } from '@/lib/db/schema';
import { createCase } from './intake';

/**
 * createCase × ความยินยอม — ทุกช่องทางต้องมี record data_collection ตั้งแต่ตอนแจ้ง
 * (เดิมบอทไม่บันทึก → เรื่องจากบอท 404 บน /track) รันกับ Postgres จริง
 */

const RUN = Date.now();
const LINE_BOT = `U-it-intake-bot-${RUN}`;
const LINE_LIFF = `U-it-intake-liff-${RUN}`;
let categoryId: string;
const caseIds: string[] = [];
const submitterIds = new Set<string>();

beforeAll(async () => {
  const db = await getDb();
  const [category] = await db.select().from(categories).limit(1);
  if (!category) throw new Error('ไม่มี category ใน DB — รัน `npx tsx scripts/seed.ts` ก่อน');
  categoryId = category.id;
});

afterAll(async () => {
  const db = await getDb();
  if (caseIds.length > 0) {
    await db.delete(dedupHashes).where(inArray(dedupHashes.caseId, caseIds));
    await db.delete(auditLogs).where(inArray(auditLogs.resourceId, caseIds));
    await db.delete(cases).where(inArray(cases.id, caseIds));
  }
  if (submitterIds.size > 0) {
    await db.delete(consentRecords).where(inArray(consentRecords.userId, [...submitterIds]));
  }
  await db.delete(lineUsers).where(inArray(lineUsers.lineUserId, [LINE_BOT, LINE_LIFF]));
  if (submitterIds.size > 0) {
    await db.delete(users).where(inArray(users.id, [...submitterIds]));
  }
  await closeDb();
});

async function submitterOf(caseId: string): Promise<string> {
  const db = await getDb();
  const [row] = await db
    .select({ submittedBy: cases.submittedBy })
    .from(cases)
    .where(eq(cases.id, caseId))
    .limit(1);
  if (!row) throw new Error(`ไม่พบเรื่อง ${caseId}`);
  submitterIds.add(row.submittedBy);
  return row.submittedBy;
}

async function grantedViasOf(userId: string): Promise<Array<string | undefined>> {
  const db = await getDb();
  const rows = await db.select().from(consentRecords).where(eq(consentRecords.userId, userId));
  return rows
    .filter((r) => r.isGranted && r.consentType === 'data_collection')
    .map((r) => (r.metadata as { via?: string } | null)?.via);
}

describe('createCase · บันทึกความยินยอมทุกช่องทาง', () => {
  test('แจ้งผ่านบอท LINE → บันทึก data_collection via line_bot_submit', async () => {
    const result = await createCase({
      channel: 'line',
      lineUserId: LINE_BOT,
      categoryId,
      title: `บอท consent ${RUN}`,
      description: 'รายละเอียดทดสอบช่องทางบอท',
      location: 'ทดสอบ ตำบลหัวงัว',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    caseIds.push(result.caseId);
    expect(await grantedViasOf(await submitterOf(result.caseId))).toContain('line_bot_submit');
  });

  test('แจ้งผ่าน LIFF → ยังบันทึก via liff_submit ตามเดิม', async () => {
    const result = await createCase({
      channel: 'line',
      origin: 'liff',
      lineUserId: LINE_LIFF,
      categoryId,
      title: `LIFF consent ${RUN}`,
      description: 'รายละเอียดทดสอบช่องทาง LIFF',
      location: 'ทดสอบ ตำบลหัวงัว',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    caseIds.push(result.caseId);
    expect(await grantedViasOf(await submitterOf(result.caseId))).toContain('liff_submit');
  });
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npx vitest run src/lib/cases/intake.integration.test.ts`
Expected: FAIL 1 test — `แจ้งผ่านบอท LINE …`: `expected [] to include 'line_bot_submit'` (test LIFF ผ่าน)

- [ ] **Step 3: เขียน `consent-policy.ts`**

สร้าง `src/lib/cases/citizen-access/consent-policy.ts`:

```ts
import type { DbOrTx } from '../../db';
import { grantConsent, CONSENT_VERSION } from '../../consent';

/** ช่องทางที่ให้ความยินยอมตอนแจ้งเรื่องใหม่ — เก็บใน consent_records.metadata.via */
export type IntakeConsentVia = 'intake_submit' | 'liff_submit' | 'line_bot_submit';

/**
 * บันทึกความยินยอม data_collection ตอนแจ้งเรื่องใหม่
 *
 * § เว็บ/LIFF ติ๊ก checkbox, บอทถือว่าการพิมพ์ "ยืนยัน" หลังข้อความแจ้ง
 * (BOT_CONSENT_NOTICE ใน line/bot/case-flow.ts) = ยินยอม — ถ้าข้อความนั้นหายไป
 * การบันทึก via line_bot_submit จะไม่มีฐานรองรับ
 */
export async function recordIntakeConsent(
  userId: string,
  via: IntakeConsentVia,
  ctx: { ipAddress?: string; userAgent?: string } = {},
  db?: DbOrTx,
): Promise<void> {
  await grantConsent(
    {
      userId,
      consentType: 'data_collection',
      version: CONSENT_VERSION,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { via },
    },
    db,
  );
}
```

- [ ] **Step 4: export จาก `index.ts`**

ต่อท้าย `src/lib/cases/citizen-access/index.ts`:

```ts
export { recordIntakeConsent, type IntakeConsentVia } from './consent-policy';
```

- [ ] **Step 5: ให้ `createCase` บันทึกทุกช่องทาง**

ใน `src/lib/cases/intake.ts`:

1. ลบ import `import { grantConsent, CONSENT_VERSION } from '../consent';`
2. แก้ import ของ citizen-access เป็น:

```ts
import {
  recordIntakeConsent,
  resolveCitizen,
  type CitizenIdentity,
  type IntakeConsentVia,
} from './citizen-access';
```

3. แทนบล็อกเดิม

```ts
  // § LIFF เป็นฟอร์มเว็บในหน้าต่าง LINE — consent เก็บเท่ากับทางเว็บ (ต่างจากบอท
  // ซึ่งเก็บข้อมูลน้อยกว่าและไม่มี checkbox ความยินยอมในแชท)
  if (input.channel === 'web' || input.origin === 'liff') {
    await grantConsent({
      userId: submitterId,
      consentType: 'data_collection',
      version: CONSENT_VERSION,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: { via: input.origin === 'liff' ? 'liff_submit' : 'intake_submit' },
    });
  }
```

ด้วย

```ts
  // § ทุกช่องทางบันทึกความยินยอมตอนแจ้ง — เดิมบอทไม่บันทึกเพราะไม่มี checkbox ในแชท
  // ผลคือเรื่องจากบอท 404 บน /track ขณะที่บอทเองโชว์ได้ (กติกาไม่เท่ากัน)
  // ตอนนี้บอทแจ้ง BOT_CONSENT_NOTICE ก่อน "ยืนยัน" แล้วบันทึกเป็น line_bot_submit
  await recordIntakeConsent(
    submitterId,
    intakeConsentVia(input),
    { ipAddress: input.ipAddress, userAgent: input.userAgent },
    db,
  );
```

4. ต่อท้ายไฟล์:

```ts
function intakeConsentVia(input: CaseIntakeInput): IntakeConsentVia {
  if (input.channel === 'web') return 'intake_submit';
  return input.origin === 'liff' ? 'liff_submit' : 'line_bot_submit';
}
```

- [ ] **Step 6: แก้ cleanup ของ submit integration test**

ใน `src/app/api/cases/submit/route.integration.test.ts` แทน

```ts
  if (createdLineUserIds.length > 0) {
    await db.delete(lineUsers).where(inArray(lineUsers.lineUserId, createdLineUserIds));
    await db.delete(users).where(like(users.email, 'line-U-dedup-%@placeholder.local'));
  }
```

ด้วย

```ts
  if (createdLineUserIds.length > 0) {
    // § createCase ช่องทาง line บันทึก consent แล้ว (citizen-access) — ล้างก่อนลบ users
    const lineOwners = await db
      .select({ id: users.id })
      .from(users)
      .where(like(users.email, 'line-U-dedup-%@placeholder.local'));
    if (lineOwners.length > 0) {
      await db.delete(consentRecords).where(inArray(consentRecords.userId, lineOwners.map((u) => u.id)));
    }
    await db.delete(lineUsers).where(inArray(lineUsers.lineUserId, createdLineUserIds));
    await db.delete(users).where(like(users.email, 'line-U-dedup-%@placeholder.local'));
  }
```

- [ ] **Step 7: รัน test ให้ผ่าน**

Run: `npx vitest run src/lib/cases/intake.integration.test.ts src/lib/cases/intake.test.ts src/lib/line/bot/case-flow.test.ts src/app/api/cases/submit/route.integration.test.ts`
Expected: PASS ทั้งหมด

- [ ] **Step 8: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/lib/cases src/app/api/cases`
Expected: exit 0

- [ ] **Step 9: Commit**

```bash
git add src/lib/cases/citizen-access/consent-policy.ts src/lib/cases/citizen-access/index.ts src/lib/cases/intake.ts src/lib/cases/intake.integration.test.ts src/app/api/cases/submit/route.integration.test.ts
git commit -m "feat(citizen-access): record data_collection consent at intake on every channel including the LINE bot"
```

---

### Task 4: ข้อความแจ้งความยินยอมในบอทก่อน "ยืนยัน"

**Files:**
- Modify: `src/lib/line/bot/case-flow.ts` (เพิ่ม const หลัง `CATEGORY_KEYWORDS`, แก้ข้อความสรุปใน `case 'location'`)
- Test: `src/lib/line/bot/case-flow.test.ts` (import บรรทัด 54 + describe location step)

**Interfaces:**
- Consumes: ไม่มี
- Produces: `export const BOT_CONSENT_NOTICE: string`

- [ ] **Step 1: เขียน failing test**

ใน `src/lib/line/bot/case-flow.test.ts` แก้บรรทัด import:

```ts
const { startCaseFlow, processCaseFlow, BOT_CONSENT_NOTICE } = await import('./case-flow');
```

เพิ่ม test ใน describe `'case-flow · processCaseFlow · location step'`:

```ts
  it('§ สรุปก่อนยืนยันต้องแจ้งว่าการยืนยัน = ให้ความยินยอม (createCase บันทึก line_bot_submit)', async () => {
    const s = state('location', {
      categoryId: 'cat-road',
      categoryName: 'ถนน-ทางเท้า',
      title: 'ถนนพัง',
      description: 'มีหลุมบ่อใหญ่',
    });
    const text = firstReplyText(await flow('หน้าวัดหัวงัว หมู่ 3', s));

    expect(text).toContain('ยินยอม');
    expect(text).toContain('043-601-494');
    expect(text).toContain(BOT_CONSENT_NOTICE);
    // ข้อความแจ้งต้องมาก่อนคำสั่ง "ยืนยัน" ไม่ใช่หลัง
    expect(text.indexOf(BOT_CONSENT_NOTICE)).toBeLessThan(text.indexOf('พิมพ์ "ยืนยัน" เพื่อส่งเรื่อง'));
  });
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npx vitest run src/lib/line/bot/case-flow.test.ts -t "ให้ความยินยอม"`
Expected: FAIL — `expected '📋 สรุปเรื่องที่แจ้ง: …' to contain 'ยินยอม'`

- [ ] **Step 3: เพิ่มข้อความแจ้งใน `case-flow.ts`**

เพิ่มหลังปิดวงเล็บของ `CATEGORY_KEYWORDS`:

```ts
/**
 * § แจ้งเรื่องผ่านแชท = ให้ความยินยอม (ในแชทไม่มี checkbox) — ข้อความนี้ต้องอยู่ในสรุป
 * ก่อนผู้ใช้พิมพ์ "ยืนยัน" เสมอ เพราะ createCase บันทึก consent via line_bot_submit
 * ทันทีที่ยืนยัน (ดู citizen-access/consent-policy.ts) — ถ้าลบข้อความนี้ การบันทึกนั้นไม่มีฐานรองรับ
 */
export const BOT_CONSENT_NOTICE =
  '🔒 การพิมพ์ "ยืนยัน" ถือว่าท่านยินยอมให้ อบต.หัวงัว เก็บและใช้ข้อมูลที่แจ้งในแชทนี้ (รวมถึงชื่อที่แสดงและรหัสผู้ใช้ LINE) เพื่อดำเนินการเรื่องของท่าน ตามนโยบายความเป็นส่วนตัวของ อบต. — หากต้องการถอนความยินยอม ติดต่อ 043-601-494';
```

ใน `case 'location'` แทนค่า `text` เป็น:

```ts
          text: `📋 สรุปเรื่องที่แจ้ง:\n\nหมวดหมู่: ${state.categoryName}\nหัวข้อ: ${state.title}\nรายละเอียด: ${state.description}\nสถานที่: ${text}\n\n${BOT_CONSENT_NOTICE}\n\nพิมพ์ "ยืนยัน" เพื่อส่งเรื่อง หรือพิมพ์ "ยกเลิก" เพื่อเริ่มใหม่`,
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npx vitest run src/lib/line/bot/case-flow.test.ts`
Expected: PASS ทั้งไฟล์ (test เดิม `'stores location and advances to confirm with summary'` ยังผ่าน)

- [ ] **Step 5: Commit**

```bash
git add src/lib/line/bot/case-flow.ts src/lib/line/bot/case-flow.test.ts
git commit -m "feat(line-bot): show PDPA consent notice in the case summary before confirmation"
```

---

### Task 5: `findTrackableCase` + `listMyCases` — กติกาการมองเห็นเดียว

**Files:**
- Modify: `src/lib/cases/citizen-access/consent-policy.ts` (เพิ่ม `consentActiveFor`)
- Create: `src/lib/cases/citizen-access/view.ts`
- Modify: `src/lib/cases/citizen-access/index.ts`
- Test: `src/lib/cases/citizen-access/view.integration.test.ts`
- Modify test: `src/lib/cases/intake.integration.test.ts` (เพิ่ม test เรื่องจากบอทติดตามได้)

**Interfaces:**
- Consumes: `normalizeTrackingCode(input: string): string | null` (`src/lib/case-tracking.ts`), `logAudit(entry, db?)`, `AUDIT_ACTIONS.VIEW_CASE`
- Produces:
  - (ภายใน module) `consentActiveFor(ownerId: AnyColumn): SQL`
  - `interface ViewContext { channel: 'web' | 'line_bot'; ipAddress?: string; userAgent?: string }`
  - `interface TrackedCaseView { case: { id; trackingCode: string; createdAt: Date; updatedAt: Date; status: CaseStatus; priority; title: string; dueDate: Date | null; closedAt: Date | null }; category: { id: string; name: string; icon: string | null } | null; updates: { id; createdAt; updateType; oldValue; newValue; comment }[] }`
  - `interface MyCaseItem { trackingCode: string; status: CaseStatus; title: string; updatedAt: string }`
  - `findTrackableCase(rawCode: string, ctx: ViewContext, db?: DbOrTx): Promise<TrackedCaseView | null>` — เขียน audit `VIEW_CASE` (ค้นด้วยเลขติดตามแบบไม่ล็อกอิน)
  - `listMyCases(lineUserId: string, db?: DbOrTx): Promise<MyCaseItem[]>` — **ไม่เขียน audit** (scope ด้านล่าง)

- [ ] **Step 1: เขียน failing test**

สร้าง `src/lib/cases/citizen-access/view.integration.test.ts`:

```ts
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { auditLogs, caseUpdates, cases, categories, consentRecords, lineUsers, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { findTrackableCase, listMyCases } from './index';

/**
 * findTrackableCase / listMyCases — กติกาการมองเห็นเรื่องของประชาชนชุดเดียวทุกช่องทาง
 * รันกับ Postgres จริง: docker compose up -d postgres redis up-redis
 */

const RUN = Date.now();
const SUFFIX = String(RUN % 100_000_000).padStart(8, '0');
const CODE_A = `HG7${SUFFIX}`;
const CODE_B = `HG6${SUFFIX}`;
const CODE_NO_CONSENT = `HG3${SUFFIX}`;
const LINE_OWNER = `U-it-ca-view-${RUN}`;

let categoryId: string;
let ownerId: string;
let noConsentOwnerId: string;
let lineRowId: string;
let caseAId: string;
const caseIds: string[] = [];

async function seedCase(values: {
  submittedBy: string;
  trackingCode: string | null;
  title: string;
  updatedAt: Date;
}): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.insert(cases).values({
    id,
    status: 'received',
    priority: 'normal',
    title: values.title,
    description: 'รายละเอียดลับ ห้ามหลุดไปหาประชาชนคนอื่น',
    location: 'บ้านเลขที่ 99 หมู่ 3',
    categoryId,
    submittedBy: values.submittedBy,
    trackingCode: values.trackingCode,
    updatedAt: values.updatedAt,
  });
  caseIds.push(id);
  return id;
}

beforeAll(async () => {
  const db = await getDb();
  const [category] = await db.select().from(categories).limit(1);
  if (!category) throw new Error('ไม่มี category ใน DB — รัน `npx tsx scripts/seed.ts` ก่อน');
  categoryId = category.id;

  ownerId = generateId();
  noConsentOwnerId = generateId();
  await db.insert(users).values([
    { id: ownerId, email: `it-ca-view-owner-${RUN}@placeholder.local`, role: 'citizen', isActive: true, fullName: 'เจ้าของเรื่องทดสอบ' },
    { id: noConsentOwnerId, email: `it-ca-view-noconsent-${RUN}@placeholder.local`, role: 'citizen', isActive: true, fullName: 'ผู้แจ้งไม่มีบันทึกความยินยอม' },
  ]);
  lineRowId = generateId();
  await db.insert(lineUsers).values({ id: lineRowId, lineUserId: LINE_OWNER, linkedUserId: ownerId });
  await db.insert(consentRecords).values({
    id: generateId(),
    userId: ownerId,
    consentType: 'data_collection',
    version: '1.1',
    isGranted: true,
    grantedAt: new Date(),
  });

  caseAId = await seedCase({ submittedBy: ownerId, trackingCode: CODE_A, title: 'ถนนพังหน้าวัด (ทดสอบ)', updatedAt: new Date('2026-01-01T00:00:00.000Z') });
  await seedCase({ submittedBy: ownerId, trackingCode: CODE_B, title: 'ไฟดับซอย 3 (ทดสอบ)', updatedAt: new Date('2026-02-01T00:00:00.000Z') });
  await seedCase({ submittedBy: ownerId, trackingCode: null, title: 'เรื่องเก่าไม่มีเลขติดตาม', updatedAt: new Date('2026-03-01T00:00:00.000Z') });
  await seedCase({ submittedBy: noConsentOwnerId, trackingCode: CODE_NO_CONSENT, title: 'เรื่องที่ไม่มีบันทึกความยินยอม', updatedAt: new Date() });

  await db.insert(caseUpdates).values([
    { id: generateId(), caseId: caseAId, userId: ownerId, updateType: 'status_change', oldValue: 'pending', newValue: 'received', isPublic: true },
    { id: generateId(), caseId: caseAId, userId: ownerId, updateType: 'comment', comment: 'บันทึกภายใน ไม่แสดงให้ประชาชนเห็น', isPublic: false },
  ]);
});

afterAll(async () => {
  const db = await getDb();
  await db.delete(auditLogs).where(inArray(auditLogs.resourceId, caseIds));
  await db.delete(caseUpdates).where(inArray(caseUpdates.caseId, caseIds));
  await db.delete(cases).where(inArray(cases.id, caseIds));
  await db.delete(consentRecords).where(inArray(consentRecords.userId, [ownerId, noConsentOwnerId]));
  await db.delete(lineUsers).where(eq(lineUsers.id, lineRowId));
  await db.delete(users).where(inArray(users.id, [ownerId, noConsentOwnerId]));
  await closeDb();
});

describe('findTrackableCase', () => {
  test('คืนเฉพาะข้อมูลที่ประชาชนเห็นได้ — ไม่มี PII, ไทม์ไลน์เฉพาะ public, รับเลขที่พิมพ์มีเว้นวรรค', async () => {
    const typed = ` ${CODE_A.slice(0, 6).toLowerCase()} ${CODE_A.slice(6)} `;
    const view = await findTrackableCase(typed, { channel: 'web' });

    expect(view).not.toBeNull();
    expect(view!.case.trackingCode).toBe(CODE_A);
    expect(view!.case.title).toBe('ถนนพังหน้าวัด (ทดสอบ)');
    expect(view!.category?.id).toBe(categoryId);
    expect(Object.keys(view!.case).sort()).toEqual([
      'closedAt', 'createdAt', 'dueDate', 'id', 'priority', 'status', 'title', 'trackingCode', 'updatedAt',
    ]);
    expect(view!.updates).toHaveLength(1);
    expect(view!.updates[0]!.updateType).toBe('status_change');
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain('บ้านเลขที่ 99');
    expect(serialized).not.toContain('รายละเอียดลับ');
    expect(serialized).not.toContain(ownerId);
  });

  test('รูปแบบผิด / ไม่มีเลขนี้ → null (คำตอบเดียวกับไม่พบ)', async () => {
    expect(await findTrackableCase('019f5c00-932f-776b-9203-ac13c48c2937', { channel: 'web' })).toBeNull();
    expect(await findTrackableCase(`HG2${SUFFIX}`, { channel: 'line_bot' })).toBeNull();
  });

  test('§ ไม่มีบันทึกความยินยอมเลย → null ทุกช่องทาง', async () => {
    expect(await findTrackableCase(CODE_NO_CONSENT, { channel: 'web' })).toBeNull();
    expect(await findTrackableCase(CODE_NO_CONSENT, { channel: 'line_bot' })).toBeNull();
  });

  test('ทุกการเข้าดูถูก audit พร้อมช่องทาง', async () => {
    await findTrackableCase(CODE_A, { channel: 'web', ipAddress: '203.0.113.9', userAgent: 'vitest' });
    await findTrackableCase(CODE_A, { channel: 'line_bot' });

    const db = await getDb();
    const rows = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.resourceId, caseAId), eq(auditLogs.action, 'view_case')));
    const vias = rows.map((r) => (r.metadata as { via?: string } | null)?.via);
    expect(vias).toContain('tracking_code');
    expect(vias).toContain('line_bot');
    expect(rows.some((r) => r.ipAddress === '203.0.113.9')).toBe(true);
  });
});

describe('listMyCases', () => {
  test('เรื่องของฉัน: เฉพาะของ LINE user นี้ ที่มีเลขติดตาม เรียงที่อัปเดตล่าสุดก่อน', async () => {
    const items = await listMyCases(LINE_OWNER);

    expect(items.map((i) => i.trackingCode)).toEqual([CODE_B, CODE_A]);
    expect(items[0]).toEqual({
      trackingCode: CODE_B,
      status: 'received',
      title: 'ไฟดับซอย 3 (ทดสอบ)',
      updatedAt: '2026-02-01T00:00:00.000Z',
    });
  });

  test('LINE user ที่ไม่ได้ผูกกับใคร → []', async () => {
    expect(await listMyCases(`U-it-ca-nobody-${RUN}`)).toEqual([]);
  });

  test('ไม่เขียน audit — ผู้ดูคือเจ้าของ LIFF ที่ยืนยันตัวแล้ว ไม่ใช่การค้นเลขติดตามแบบไม่ล็อกอิน', async () => {
    const db = await getDb();
    const before = await db
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(eq(auditLogs.resourceId, caseAId));
    await listMyCases(LINE_OWNER);
    const after = await db
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(eq(auditLogs.resourceId, caseAId));
    expect(after).toHaveLength(before.length);
  });
});

describe('§ ถอนความยินยอมแล้ว — ซ่อนทุกช่องทาง', () => {
  test('record ล่าสุดเป็นการถอน → เว็บ/บอทไม่พบ และเรื่องของฉันว่าง', async () => {
    const db = await getDb();
    await db.insert(consentRecords).values({
      id: generateId(),
      userId: ownerId,
      consentType: 'data_collection',
      version: '1.1',
      isGranted: false,
      revokedAt: new Date(),
    });

    expect(await findTrackableCase(CODE_A, { channel: 'web' })).toBeNull();
    expect(await findTrackableCase(CODE_A, { channel: 'line_bot' })).toBeNull();
    expect(await listMyCases(LINE_OWNER)).toEqual([]);
  });

  test('timestamp เท่ากัน → id DESC เป็นตัวตัดสิน (UUID v7); grant ระดับ user ทำให้เรื่องเก่ากลับมา', async () => {
    const db = await getDb();
    const sameTime = new Date('2026-03-01T00:00:00.000Z');
    const olderId = '00000000-0000-7000-8000-000000000001';
    const newerId = 'ffffffff-ffff-7fff-bfff-ffffffffffff';
    await db.insert(consentRecords).values([
      {
        id: newerId,
        userId: ownerId,
        consentType: 'data_collection',
        version: '1.1',
        isGranted: true,
        grantedAt: sameTime,
        createdAt: sameTime,
      },
      {
        id: olderId,
        userId: ownerId,
        consentType: 'data_collection',
        version: '1.1',
        isGranted: false,
        revokedAt: sameTime,
        createdAt: sameTime,
      },
    ]);

    // id มากกว่าชนะแม้ created_at เท่ากัน — grant ระดับ user ทำให้เรื่องเก่ามองเห็นอีก
    expect(await findTrackableCase(CODE_A, { channel: 'web' })).not.toBeNull();
  });
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npx vitest run src/lib/cases/citizen-access/view.integration.test.ts`
Expected: FAIL ทุก test — `TypeError: findTrackableCase is not a function` (หรือ `… does not provide an export named 'findTrackableCase'`)

- [ ] **Step 3: เพิ่ม `consentActiveFor` ใน `consent-policy.ts`**

แทนบรรทัด import ของ `src/lib/cases/citizen-access/consent-policy.ts` ด้วย:

```ts
import { sql, type AnyColumn, type SQL } from 'drizzle-orm';
import { consentRecords } from '../../db/schema';
import { grantConsent, CONSENT_VERSION } from '../../consent';
```

ต่อท้ายไฟล์:

```ts
/**
 * กติกาเดียวของทุกช่องทาง (เว็บ / บอท / LIFF): ประชาชนเห็นเรื่องได้ก็ต่อเมื่อ record
 * data_collection ล่าสุดของเจ้าของเรื่องเป็นการให้ความยินยอม
 *
 * § ไม่มี record เลย = ไม่เห็น (ตรงกับ hasConsent เดิม) — ผู้แจ้งผ่านบอทก่อนมี
 * recordIntakeConsent จึงต้องรัน scripts/backfill-bot-consent.ts หลัง deploy
 * § "ล่าสุด" = ORDER BY created_at DESC, id DESC
 * generateId() คือ UUID v7 (timestamp-ordered, monotonic — src/lib/id.ts) จึงใช้เป็น
 * tie-break ของแถวที่เขียนคนละจังหวะได้ แต่สองแถวที่ created_at เท่ากันและ id ไม่เรียง
 * ตาม commit order ถือเป็น ambiguity ที่ยอมรับได้ (ไม่มี test ที่บังคับลำดับ commit
 * ข้าม connection) — มี test กรณี timestamp เท่ากันด้านล่าง
 * § grant ใหม่เป็นระดับ user ไม่ใช่ระดับเรื่อง — เจ้าของเดิมแจ้งเรื่องใหม่อีกครั้งหลังถอน
 * จะทำให้เรื่องเก่าทั้งหมดกลับมองเห็นได้ (ตั้งใจ เหมือนทางเว็บเดิม)
 * § เป็น correlated subquery ใน WHERE เดียวกับ lookup — "ไม่พบ" กับ "ถอนแล้ว"
 * จึงแยกกันไม่ออกจากภายนอก (กัน enumeration) และ list ไม่ต้องยิง N query
 */
export function consentActiveFor(ownerId: AnyColumn): SQL {
  return sql`coalesce((
    select ${consentRecords.isGranted}
    from ${consentRecords}
    where ${consentRecords.userId} = ${ownerId}
      and ${consentRecords.consentType} = 'data_collection'
    order by ${consentRecords.createdAt} desc, ${consentRecords.id} desc
    limit 1
  ), false)`;
}
```

- [ ] **Step 4: เขียน `view.ts`**

สร้าง `src/lib/cases/citizen-access/view.ts`:

```ts
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { getDb, type DbOrTx } from '../../db';
import { firstOrUndefined } from '../../db/query-helpers';
import { caseUpdates, cases, categories, lineUsers } from '../../db/schema';
import { AUDIT_ACTIONS, logAudit } from '../../audit';
import { normalizeTrackingCode } from '../../case-tracking';
import type { CaseStatus } from '../state-machine';
import { consentActiveFor } from './consent-policy';

type CaseRow = typeof cases.$inferSelect;
type CategoryRow = typeof categories.$inferSelect;
type CaseUpdateRow = typeof caseUpdates.$inferSelect;

/** ช่องทางที่ประชาชนใช้ดูเรื่อง — บันทึกเป็น audit metadata.via */
export interface ViewContext {
  channel: 'web' | 'line_bot';
  ipAddress?: string;
  userAgent?: string;
}

/**
 * ข้อมูลเรื่องที่ประชาชนเห็นได้ — สถานะ + หัวเรื่อง + หมวด + ไทม์ไลน์ public เท่านั้น
 * § ไม่มี ชื่อ/เบอร์/ที่อยู่/รายละเอียด/เอกสารแนบ/department/submitter/assignedOfficer
 */
export interface TrackedCaseView {
  case: Pick<CaseRow, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'priority' | 'title' | 'dueDate' | 'closedAt'> & {
    trackingCode: string;
  };
  category: Pick<CategoryRow, 'id' | 'name' | 'icon'> | null;
  updates: Pick<CaseUpdateRow, 'id' | 'createdAt' | 'updateType' | 'oldValue' | 'newValue' | 'comment'>[];
}

/** แถว "เรื่องของฉัน" — updatedAt เป็น ISO string เพื่อข้าม server→client boundary ได้ */
export interface MyCaseItem {
  trackingCode: string;
  status: CaseStatus;
  title: string;
  updatedAt: string;
}

const MY_CASES_LIMIT = 20;

// § คงค่า 'tracking_code' ของเว็บไว้ตามเดิม — audit เก่าใช้ค่านี้ ค้นย้อนหลังได้ต่อเนื่อง
const VIEW_VIA: Record<ViewContext['channel'], string> = {
  web: 'tracking_code',
  line_bot: 'line_bot',
};

/**
 * ค้นเรื่องด้วยเลขติดตามสำหรับประชาชน (ติดตามเรื่องทางเว็บ + บอท LINE)
 * คืน null เหมือนกันทุกกรณี: รูปแบบผิด / ไม่พบ / เรื่องเก่าไม่มีเลข / เจ้าของถอนความยินยอม
 */
export async function findTrackableCase(
  rawCode: string,
  ctx: ViewContext,
  db?: DbOrTx,
): Promise<TrackedCaseView | null> {
  // § format ผิด → null ไม่ใช่ error เพื่อไม่เปิดเผยว่า format ผิด (กัน enumeration)
  const trackingCode = normalizeTrackingCode(rawCode);
  if (!trackingCode) return null;
  const _db = db ?? (await getDb());

  const row = await firstOrUndefined(
    _db
      .select({
        id: cases.id,
        createdAt: cases.createdAt,
        updatedAt: cases.updatedAt,
        status: cases.status,
        priority: cases.priority,
        title: cases.title,
        dueDate: cases.dueDate,
        closedAt: cases.closedAt,
        categoryId: cases.categoryId,
      })
      .from(cases)
      .where(and(eq(cases.trackingCode, trackingCode), consentActiveFor(cases.submittedBy)))
      .limit(1),
  );
  if (!row) return null;

  const category = await firstOrUndefined(
    _db
      .select({ id: categories.id, name: categories.name, icon: categories.icon })
      .from(categories)
      .where(eq(categories.id, row.categoryId))
      .limit(1),
  );

  // § public only — บันทึกภายใน (isPublic = false) ไม่ออกไปหาประชาชน
  const updates = await _db
    .select({
      id: caseUpdates.id,
      createdAt: caseUpdates.createdAt,
      updateType: caseUpdates.updateType,
      oldValue: caseUpdates.oldValue,
      newValue: caseUpdates.newValue,
      comment: caseUpdates.comment,
    })
    .from(caseUpdates)
    .where(and(eq(caseUpdates.caseId, row.id), eq(caseUpdates.isPublic, true)))
    .orderBy(caseUpdates.createdAt);

  await logAudit(
    {
      action: AUDIT_ACTIONS.VIEW_CASE,
      resource: 'cases',
      resourceId: row.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { via: VIEW_VIA[ctx.channel] },
    },
    _db,
  );

  return {
    case: {
      id: row.id,
      trackingCode,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      status: row.status,
      priority: row.priority,
      title: row.title,
      dueDate: row.dueDate,
      closedAt: row.closedAt,
    },
    category: category ?? null,
    updates,
  };
}

/**
 * "เรื่องของฉัน" ใน LIFF — เรื่องที่ผูกกับบัญชี LINE นี้ (line_users.linked_user_id = cases.submitted_by)
 * § ใช้กติกาความยินยอมเดียวกับ findTrackableCase — ถอนแล้วหายจากรายการด้วย
 * § ไม่เขียน audit: audit การเข้าดูมีเฉพาะการค้นด้วยเลขติดตามแบบไม่ล็อกอิน
 * (findTrackableCase) "เรื่องของฉัน" ผู้ดูคือเจ้าของที่ยืนยันตัวผ่าน LIFF แล้ว ไม่ใช่ช่องทางไม่ล็อกอิน
 */
export async function listMyCases(lineUserId: string, db?: DbOrTx): Promise<MyCaseItem[]> {
  const _db = db ?? (await getDb());

  const rows = await _db
    .select({
      trackingCode: cases.trackingCode,
      status: cases.status,
      title: cases.title,
      updatedAt: cases.updatedAt,
    })
    .from(cases)
    .innerJoin(lineUsers, eq(lineUsers.linkedUserId, cases.submittedBy))
    .where(
      and(
        eq(lineUsers.lineUserId, lineUserId),
        isNotNull(cases.trackingCode),
        consentActiveFor(cases.submittedBy),
      ),
    )
    .orderBy(desc(cases.updatedAt))
    .limit(MY_CASES_LIMIT);

  // § เคสเก่าที่ไม่มี trackingCode ถูกตัดใน SQL แล้ว — flatMap ทำให้ type แคบลงโดยไม่ใช้ `!`
  return rows.flatMap((r) =>
    r.trackingCode
      ? [{ trackingCode: r.trackingCode, status: r.status, title: r.title, updatedAt: r.updatedAt.toISOString() }]
      : [],
  );
}
```

- [ ] **Step 5: export จาก `index.ts`**

ต่อท้าย `src/lib/cases/citizen-access/index.ts`:

```ts
export {
  findTrackableCase,
  listMyCases,
  type MyCaseItem,
  type TrackedCaseView,
  type ViewContext,
} from './view';
```

- [ ] **Step 6: รัน test ให้ผ่าน**

Run: `npx vitest run src/lib/cases/citizen-access/view.integration.test.ts`
Expected: PASS 9 tests (7 เดิม + listMyCases ไม่เขียน audit + timestamp เท่ากัน)

- [ ] **Step 7: เพิ่ม test "เรื่องจากบอทติดตามได้ทันที" ใน intake integration**

ใน `src/lib/cases/intake.integration.test.ts` เพิ่ม import:

```ts
import { findTrackableCase } from './citizen-access';
```

และเพิ่ม test ท้าย describe:

```ts
  test('เรื่องที่แจ้งผ่านบอทติดตามได้ทันทีทั้งทางเว็บและทางบอท', async () => {
    const title = `บอท ติดตามได้ ${RUN}`;
    const result = await createCase({
      channel: 'line',
      lineUserId: LINE_BOT,
      categoryId,
      title,
      description: 'รายละเอียดทดสอบติดตามเรื่องจากบอท',
      location: 'ทดสอบ ตำบลหัวงัว',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    caseIds.push(result.caseId);
    await submitterOf(result.caseId);

    expect((await findTrackableCase(result.trackingCode, { channel: 'web' }))?.case.title).toBe(title);
    expect(await findTrackableCase(result.trackingCode, { channel: 'line_bot' })).not.toBeNull();
  });
```

Run: `npx vitest run src/lib/cases/intake.integration.test.ts`
Expected: PASS 3 tests

- [ ] **Step 8: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/lib/cases`
Expected: exit 0

- [ ] **Step 9: Commit**

```bash
git add src/lib/cases/citizen-access/consent-policy.ts src/lib/cases/citizen-access/view.ts src/lib/cases/citizen-access/index.ts src/lib/cases/citizen-access/view.integration.test.ts src/lib/cases/intake.integration.test.ts
git commit -m "feat(citizen-access): add findTrackableCase and listMyCases with one consent rule for every channel"
```

---

### Task 6: เว็บ "ติดตามเรื่อง" + "เรื่องของฉัน" เป็นผู้เรียกบาง ๆ

**Files:**
- Modify: `src/app/api/cases/[id]/route.ts` (ทั้งไฟล์)
- Modify: `src/app/track/page.tsx:9,17-23,38`
- Delete: `src/lib/cases/my-cases.ts`, `src/lib/cases/my-cases.test.ts`
- Modify: `e2e/track-liff.spec.ts:4,20-67` (seed + cleanup consent)
- Test (เดิม): `src/app/api/cases/[id]/route.integration.test.ts`, `e2e/track.spec.ts`, `e2e/track-liff.spec.ts`

**Interfaces:**
- Consumes: `findTrackableCase(rawCode, ctx, db?)`, `listMyCases(lineUserId, db?)` จาก `@/lib/cases/citizen-access` (Task 5)
- Produces: response ของ `GET /api/cases/[id]` = `TrackedCaseView` (เดิม + field `case.trackingCode`)

- [ ] **Step 1: ทำ e2e track-liff ให้ตรงกติกาใหม่ก่อน (failing ภายใต้กติกาใหม่)**

ใน `e2e/track-liff.spec.ts` แก้ import บรรทัด 4:

```ts
import { cases, categories, consentRecords, lineUsers, users } from '../src/lib/db/schema';
```

หลัง `await db.insert(lineUsers).values({...});` ใน `beforeAll` เพิ่ม:

```ts
  // § "เรื่องของฉัน" ใช้กติกาเดียวกับ /track — เจ้าของต้องมีความยินยอม data_collection ล่าสุด
  await db.insert(consentRecords).values({
    id: generateId(),
    userId: testUserId,
    consentType: 'data_collection',
    version: '1.1',
    isGranted: true,
    grantedAt: new Date(),
  });
```

ใน `afterAll` ก่อน `await db.delete(users)...` เพิ่ม:

```ts
  await db.delete(consentRecords).where(eq(consentRecords.userId, testUserId));
```

- [ ] **Step 2: เขียน route ใหม่**

แทนทั้งไฟล์ `src/app/api/cases/[id]/route.ts`:

```ts
/**
 * GET /api/cases/[id] — ดูสถานะเรื่องที่แจ้ง (สำหรับ citizen track)
 *
 * [id] คือ **trackingCode** (HG/HN + 9 หลัก) ไม่ใช่ UUID PK
 * เพื่อไม่เปิดเผย UUID v7 ที่ timestamp-ordered และเดาได้
 *
 * ความปลอดภัย (PDPA):
 * - Rate limit 10 ครั้ง/5 นาทีต่อ IP — กัน brute force tracking code (อยู่ที่ route นี้)
 * - Tracking code เป็น random 30-bit + rate limit → คาดเดาไม่ได้ในทางปฏิบัติ
 * - การค้น / กติกาความยินยอม / ตัด PII / audit อยู่ใน citizen-access (กติกาเดียวกับบอท LINE)
 * - 404 ทุกกรณีที่ไม่พบ (format ผิด / code ผิด / เคสเก่าไม่มี trackingCode / ถอนความยินยอมแล้ว)
 *   ไม่บอกสาเหตุ เพื่อกัน enumeration
 */

import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit/enforce';
import { clientIpFromHeaders } from '@/lib/rate-limit/client-ip';
import { findTrackableCase } from '@/lib/cases/citizen-access';

const NOT_FOUND = { error: 'ไม่พบเรื่องนี้' };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const ip = clientIpFromHeaders(req.headers);

  // § Rate limit — 10 requests / 5 minutes per IP (fail-open เหมือน submit)
  // (RATE_LIMIT_POLICIES.track — c7 merge ก่อนเสมอ; ทำ c1 เดี่ยวชั่วคราว:
  // const rateLimit = await checkRateLimit(`rate:track:${ip}`, 10, 300);)
  const rateLimit = await enforceRateLimit('track', ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'ค้นหาถี่เกินไป กรุณารอ ' + rateLimit.reset + ' วินาที' },
      { status: 429 }
    );
  }

  const view = await findTrackableCase(rawId, {
    channel: 'web',
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') || undefined,
  });
  if (!view) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  return NextResponse.json(view);
}
```

- [ ] **Step 3: หน้า `/track` ใช้ `listMyCases`**

ใน `src/app/track/page.tsx`:

แทน `import { getMyCases } from '@/lib/cases/my-cases';` ด้วย

```ts
import { listMyCases } from '@/lib/cases/citizen-access';
```

แทนประโยคใน docblock

```ts
 * ถ้ามี liff session cookie (เข้าจาก LINE) จะแสดง "เรื่องของฉัน" — เคสทุกเรื่อง
 * ที่ผูกกับบัญชี LINE ของผู้ใช้ โดยไม่ต้องพิมพ์รหัส (D2)
```

ด้วย

```ts
 * ถ้ามี liff session cookie (เข้าจาก LINE) จะแสดง "เรื่องของฉัน" — เคสทุกเรื่อง
 * ที่ผูกกับบัญชี LINE ของผู้ใช้ โดยไม่ต้องพิมพ์รหัส (D2) เฉพาะเรื่องที่เจ้าของยังให้
 * ความยินยอมอยู่ (กติกาเดียวกับ GET /api/cases/[id] — ดู citizen-access)
```

แทน `const myCases = liffSession ? await getMyCases(liffSession.lineUserId) : [];` ด้วย

```ts
  const myCases = liffSession ? await listMyCases(liffSession.lineUserId) : [];
```

- [ ] **Step 4: ลบ `my-cases` เดิม**

```bash
git rm src/lib/cases/my-cases.ts src/lib/cases/my-cases.test.ts
```

(invariant "ตัดเคสไม่มี trackingCode" ถูกทดสอบที่ interface แล้วใน `view.integration.test.ts` → `listMyCases` test แรก)

- [ ] **Step 5: รัน unit/integration ของ route**

Run: `npx vitest run "src/app/api/cases/[id]/route.integration.test.ts" src/lib/cases/citizen-access`
Expected: PASS ทั้งหมด (route test 4 ข้อเดิมผ่านโดยไม่ต้องแก้ — fixture มี consent อยู่แล้ว)

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/app/api/cases src/app/track e2e/track-liff.spec.ts`
Expected: exit 0 (ไม่มีไฟล์ไหน import `@/lib/cases/my-cases` แล้ว)

- [ ] **Step 7: รัน e2e ของหน้า track**

เปิด dev server ใน terminal แยก (Playwright `webServer` ใช้ `pnpm dev` ซึ่งค้าง — ต้องเปิดเองให้ `reuseExistingServer` จับ):

```bash
# bash
LIFF_E2E_MOCK=1 npx next dev
# PowerShell — ตั้งใน terminal นี้และ terminal ที่รัน playwright
$env:LIFF_E2E_MOCK = '1'; npx next dev
```

แล้วรัน:

```bash
# bash
LIFF_E2E_MOCK=1 npx playwright test e2e/track.spec.ts e2e/track-liff.spec.ts
# PowerShell
$env:LIFF_E2E_MOCK = '1'; npx playwright test e2e/track.spec.ts e2e/track-liff.spec.ts
```

Expected: `track.spec.ts` 4 passed, `track-liff.spec.ts` 2 passed

- [ ] **Step 8: Commit**

```bash
git add "src/app/api/cases/[id]/route.ts" src/app/track/page.tsx e2e/track-liff.spec.ts
git commit -m "refactor(track): serve web tracking and LIFF my-cases through citizen-access"
```

(`git rm` ใน Step 4 stage การลบไว้แล้ว — จะเข้า commit นี้ด้วย)

---

### Task 7: บอท LINE "ติดตาม" ใช้กติกาเดียวกับเว็บ

**Files:**
- Modify: `src/lib/line/bot/engine.ts:3,16,252-271`
- Test: `src/lib/line/bot/engine.test.ts` (เพิ่ม mock + 2 tests ใน describe `'case tracking'`)

**Interfaces:**
- Consumes: `findTrackableCase(rawCode: string, ctx: ViewContext, db?: DbOrTx): Promise<TrackedCaseView | null>` (Task 5)
- Produces: ไม่มี

- [ ] **Step 1: เขียน failing test**

ใน `src/lib/line/bot/engine.test.ts` เพิ่ม mock ต่อจาก `vi.mock('../messages/flex', ...)`:

```ts
vi.mock('@/lib/cases/citizen-access', () => ({
  findTrackableCase: vi.fn(async () => null),
}));
```

เพิ่ม import ต่อจาก `import { startCaseFlow } from './case-flow';`:

```ts
import { findTrackableCase } from '@/lib/cases/citizen-access';
```

เพิ่มใน describe `'case tracking'`:

```ts
    it('§ ส่งเลขที่ผู้ใช้พิมพ์ให้ citizen-access ช่องทาง line_bot — กติกาความยินยอมเดียวกับเว็บ', async () => {
      const event = makeEvent('ติดตาม HG 0000 0000 0');
      await routeBotMessage(mockDb, event, 'ติดตาม HG 0000 0000 0', 'user-pk', 'conv-1');
      expect(findTrackableCase).toHaveBeenCalledWith('HG 0000 0000 0', { channel: 'line_bot' }, mockDb);
    });

    it('พบเรื่องที่ติดตามได้ → ตอบเป็น flex สถานะ', async () => {
      vi.mocked(findTrackableCase).mockResolvedValueOnce({
        case: {
          id: 'case-1',
          trackingCode: 'HG123456789',
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'in_progress',
          priority: 'normal',
          title: 'ถนนพัง',
          dueDate: null,
          closedAt: null,
        },
        category: null,
        updates: [],
      });
      const event = makeEvent('ติดตาม HG123456789');
      const replies = await routeBotMessage(mockDb, event, 'ติดตาม HG123456789', 'user-pk', 'conv-1');

      expect(replies).toHaveLength(1);
      expect(replies[0]!.type).toBe('flex');
      expect((replies[0] as { altText: string }).altText).toBe('สถานะ HG123456789');
    });
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npx vitest run src/lib/line/bot/engine.test.ts -t "case tracking"`
Expected: FAIL 2 tests — `expected "spy" to be called with arguments …` (ยังไม่เรียก) และ `expected 'text' to be 'flex'`

- [ ] **Step 3: แก้ `trackCase` ใน `engine.ts`**

แก้ import บรรทัด 3:

```ts
import { lineUsers, chatConversations, chatMessages } from '@/lib/db/schema';
```

แทน `import { normalizeTrackingCode } from '@/lib/case-tracking';` (บรรทัด 16) ด้วย:

```ts
import { findTrackableCase } from '@/lib/cases/citizen-access';
```

แทนทั้งฟังก์ชัน `trackCase` (บรรทัด 252–271) ด้วย:

```ts
async function trackCase(db: Db, trackingCode: string): Promise<LineOutgoingMessage[]> {
  // § normalize (เลขที่พิมพ์มีเว้นวรรค เช่น HG 4837 2915 6) + กติกาความยินยอม + audit
  // อยู่ใน citizen-access — เดิมบอทค้นตรงไม่เช็คความยินยอม เรื่องที่เจ้าของถอนแล้ว
  // ยังโชว์หัวเรื่อง+สถานะผ่านแชทได้ ทั้งที่เว็บตอบ 404
  const view = await findTrackableCase(trackingCode, { channel: 'line_bot' }, db);
  if (!view) {
    return [{ type: 'text', text: `ไม่พบเรื่องเลข ${trackingCode} กรุณาตรวจสอบเลขติดตามอีกครั้ง` }];
  }
  return [caseStatusFlex(view.case.trackingCode, view.case.status, view.case.title)];
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npx vitest run src/lib/line/bot/engine.test.ts`
Expected: PASS ทั้งไฟล์ (test เดิม `'returns not-found…'` และ `'§ normalize…'` ยังผ่านเพราะ mock คืน null)

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/lib/line/bot`
Expected: exit 0 (ไม่มี unused `cases` / `normalizeTrackingCode`)

- [ ] **Step 6: Commit**

```bash
git add src/lib/line/bot/engine.ts src/lib/line/bot/engine.test.ts
git commit -m "fix(line-bot): hide cases whose owner withdrew consent from bot tracking"
```

---

### Task 8: `withdrawCaseConsent` — พิสูจน์ความเป็นเจ้าของจุดเดียว

**Files:**
- Create: `src/lib/cases/citizen-access/withdraw.ts`
- Modify: `src/lib/cases/citizen-access/index.ts`
- Modify: `src/app/api/consent/withdraw/route.ts` (ทั้งไฟล์)
- Modify: `src/lib/cases/intake.test.ts:120-123` (mock consent ให้ครบ export ที่ module ใช้)
- Test: `src/lib/cases/citizen-access/withdraw.integration.test.ts`

**Interfaces:**
- Consumes: `cidPlaceholderEmail(cid)` (identity.ts, Task 1), `revokeConsentWithAudit(w, tx)` จาก `src/lib/consent.ts` (helper ของ c6 — ไม่เปิด tx เอง; ถ้า c6 ยังไม่ merge ให้เพิ่ม helper ตาม snippet ด้านล่างใน Task นี้ ห้ามเรียก `withdrawConsent` ซึ่งเปิด tx ซ้อน), `findTrackableCase` + `resolveCitizen` (ใช้ใน test)
- Produces:
  - `type OwnershipProof = { kind: 'cid'; cid: string } | { kind: 'line'; lineUserId: string }`
  - `type WithdrawResult = { ok: true } | { ok: false }`
  - `withdrawCaseConsent(rawCode: string, proof: OwnershipProof, ctx: { ipAddress?: string; userAgent?: string }, db?: DbOrTx): Promise<WithdrawResult>` — ถ้าไม่ส่ง `db` เปิด tx เอง แล้วเรียก `revokeConsentWithAudit` ภายใน tx เดียวกัน

- [ ] **Step 1: เขียน failing test**

สร้าง `src/lib/cases/citizen-access/withdraw.integration.test.ts`:

```ts
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { auditLogs, cases, categories, consentRecords, lineUsers, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { findTrackableCase, resolveCitizen, withdrawCaseConsent } from './index';

/**
 * withdrawCaseConsent — ถอนความยินยอม PDPA ด้วยหลักฐานความเป็นเจ้าของสองแบบ
 * (CID สำหรับผู้แจ้งทางเว็บ / LINE session สำหรับผู้แจ้งผ่าน LINE) รันกับ Postgres จริง
 */

const RUN = Date.now();
const SUFFIX = String(RUN % 100_000_000).padStart(8, '0');
const CODE_CID = `HG5${SUFFIX}`;
const CODE_LINE = `HG4${SUFFIX}`;
const CID = `it-ca-withdraw-cid-${RUN}`;
const LINE_OWNER = `U-it-ca-wd-owner-${RUN}`;
const LINE_STRANGER = `U-it-ca-wd-stranger-${RUN}`;
const CTX = { ipAddress: '203.0.113.7', userAgent: 'vitest' };

let categoryId: string;
let cidOwnerId: string;
let lineOwnerId: string;
let strangerId: string;
let cidCaseId: string;
let lineCaseId: string;

async function seedCase(trackingCode: string, submittedBy: string): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.insert(cases).values({
    id,
    status: 'received',
    priority: 'normal',
    title: `เรื่องทดสอบถอนความยินยอม ${trackingCode}`,
    description: 'รายละเอียดทดสอบ',
    location: 'ทดสอบ ตำบลหัวงัว',
    categoryId,
    submittedBy,
    trackingCode,
  });
  return id;
}

async function auditMetaOf(caseId: string, action: string): Promise<Array<Record<string, unknown>>> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.resourceId, caseId), eq(auditLogs.action, action)));
  return rows.map((r) => (r.metadata ?? {}) as Record<string, unknown>);
}

beforeAll(async () => {
  const db = await getDb();
  const [category] = await db.select().from(categories).limit(1);
  if (!category) throw new Error('ไม่มี category ใน DB — รัน `npx tsx scripts/seed.ts` ก่อน');
  categoryId = category.id;

  cidOwnerId = await resolveCitizen({ kind: 'cid', cid: CID, fullName: 'ผู้แจ้งเว็บทดสอบถอน' });
  lineOwnerId = await resolveCitizen({ kind: 'line', lineUserId: LINE_OWNER, source: 'liff_session' });
  strangerId = await resolveCitizen({ kind: 'line', lineUserId: LINE_STRANGER, source: 'liff_session' });

  await db.insert(consentRecords).values([cidOwnerId, lineOwnerId].map((userId) => ({
    id: generateId(),
    userId,
    consentType: 'data_collection',
    version: '1.1',
    isGranted: true,
    grantedAt: new Date(),
  })));

  cidCaseId = await seedCase(CODE_CID, cidOwnerId);
  lineCaseId = await seedCase(CODE_LINE, lineOwnerId);
});

afterAll(async () => {
  const db = await getDb();
  const caseIds = [cidCaseId, lineCaseId];
  const userIds = [cidOwnerId, lineOwnerId, strangerId];
  await db.delete(auditLogs).where(inArray(auditLogs.resourceId, caseIds));
  await db.delete(cases).where(inArray(cases.id, caseIds));
  await db.delete(consentRecords).where(inArray(consentRecords.userId, userIds));
  await db.delete(lineUsers).where(inArray(lineUsers.lineUserId, [LINE_OWNER, LINE_STRANGER]));
  await db.delete(users).where(inArray(users.id, userIds));
  await closeDb();
});

describe('withdrawCaseConsent · ปฏิเสธ', () => {
  test('เลขติดตามผิดรูปแบบ / ไม่มีอยู่ → ปฏิเสธ', async () => {
    expect(await withdrawCaseConsent('not-a-code', { kind: 'cid', cid: CID }, CTX)).toEqual({ ok: false });
    expect(await withdrawCaseConsent(`HG2${SUFFIX}`, { kind: 'cid', cid: CID }, CTX)).toEqual({ ok: false });
  });

  test('§ CID ไม่ตรงเจ้าของ → ปฏิเสธ + audit cid_mismatch และเรื่องยังติดตามได้', async () => {
    const result = await withdrawCaseConsent(CODE_CID, { kind: 'cid', cid: `${CID}-wrong` }, CTX);

    expect(result).toEqual({ ok: false });
    expect(await auditMetaOf(cidCaseId, 'consent_withdraw_denied')).toContainEqual({ reason: 'cid_mismatch' });
    expect(await findTrackableCase(CODE_CID, { channel: 'web' })).not.toBeNull();
  });

  test('§ LINE คนอื่นที่ไม่ใช่เจ้าของ → ปฏิเสธ + audit not_case_owner_line', async () => {
    const result = await withdrawCaseConsent(CODE_LINE, { kind: 'line', lineUserId: LINE_STRANGER }, CTX);

    expect(result).toEqual({ ok: false });
    expect(await auditMetaOf(lineCaseId, 'consent_withdraw_denied')).toContainEqual({ reason: 'not_case_owner_line' });
    expect(await findTrackableCase(CODE_LINE, { channel: 'line_bot' })).not.toBeNull();
  });
});

describe('withdrawCaseConsent · สำเร็จ', () => {
  test('เจ้าของผ่าน LINE ถอน → เรื่องหายจากการติดตามทุกช่องทาง + audit consent_withdrawn via liff', async () => {
    const result = await withdrawCaseConsent(CODE_LINE, { kind: 'line', lineUserId: LINE_OWNER }, CTX);

    expect(result).toEqual({ ok: true });
    expect(await findTrackableCase(CODE_LINE, { channel: 'web' })).toBeNull();
    expect(await findTrackableCase(CODE_LINE, { channel: 'line_bot' })).toBeNull();
    expect(await auditMetaOf(lineCaseId, 'consent_withdrawn')).toContainEqual({ trackingCode: CODE_LINE, via: 'liff' });
  });

  test('เจ้าของผ่าน CID ถอน (พิมพ์เลขมีเว้นวรรค) → เรื่องหายจากการติดตาม + audit via web', async () => {
    const typed = `${CODE_CID.slice(0, 2)} ${CODE_CID.slice(2)}`;
    const result = await withdrawCaseConsent(typed, { kind: 'cid', cid: CID }, CTX);

    expect(result).toEqual({ ok: true });
    expect(await findTrackableCase(CODE_CID, { channel: 'web' })).toBeNull();
    expect(await auditMetaOf(cidCaseId, 'consent_withdrawn')).toContainEqual({ trackingCode: CODE_CID, via: 'web' });
  });
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npx vitest run src/lib/cases/citizen-access/withdraw.integration.test.ts`
Expected: FAIL — `TypeError: withdrawCaseConsent is not a function` (หรือ export not found)

- [ ] **Step 3: เขียน `withdraw.ts`**

สร้าง `src/lib/cases/citizen-access/withdraw.ts`:

```ts
import { and, eq } from 'drizzle-orm';
import { getDb, type DbOrTx } from '../../db';
import { firstOrUndefined } from '../../db/query-helpers';
import { cases, lineUsers, users } from '../../db/schema';
import { AUDIT_ACTIONS, logAudit } from '../../audit';
import { normalizeTrackingCode } from '../../case-tracking';
import { revokeConsentWithAudit } from '../../consent';
import { cidPlaceholderEmail } from './identity';

/**
 * หลักฐานความเป็นเจ้าของเรื่อง
 * - cid: ผู้แจ้งทางเว็บ — CID ต้องตรงกับ placeholder ของเจ้าของเรื่อง
 * - line: ผู้แจ้งผ่าน LINE (บอท/LIFF ไม่มี CID ในระบบ) — lineUserId จาก LIFF session
 *   cookie ที่ server sign ต้องผูกกับเจ้าของเรื่อง
 */
export type OwnershipProof = { kind: 'cid'; cid: string } | { kind: 'line'; lineUserId: string };

/** § ไม่บอกเหตุผลที่ปฏิเสธ — "ไม่พบ" กับ "ไม่ใช่เจ้าของ" ต้องแยกกันไม่ออก (กัน enumeration) */
export type WithdrawResult = { ok: true } | { ok: false };

type DenialReason = 'cid_mismatch' | 'submitter_missing' | 'not_case_owner_line';

const DENIED: WithdrawResult = { ok: false };

export async function withdrawCaseConsent(
  rawCode: string,
  proof: OwnershipProof,
  ctx: { ipAddress?: string; userAgent?: string },
  db?: DbOrTx,
): Promise<WithdrawResult> {
  // § format ผิด → คำตอบเดียวกับเคสไม่พบ
  const trackingCode = normalizeTrackingCode(rawCode);
  if (!trackingCode) return DENIED;
  const _db = db ?? (await getDb());

  const caseRow = await firstOrUndefined(
    _db
      .select({ id: cases.id, submittedBy: cases.submittedBy })
      .from(cases)
      .where(eq(cases.trackingCode, trackingCode))
      .limit(1),
  );
  if (!caseRow) return DENIED;

  const denial = await ownershipDenial(_db, caseRow.submittedBy, proof);
  if (denial) {
    await logAudit(
      {
        action: AUDIT_ACTIONS.CONSENT_WITHDRAW_DENIED,
        resource: 'consent',
        resourceId: caseRow.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { reason: denial },
      },
      _db,
    );
    return DENIED;
  }

  const via = proof.kind === 'line' ? 'liff' : 'web';
  const withdrawal = {
    userId: caseRow.submittedBy,
    caseId: caseRow.id,
    trackingCode,
    via,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  } as const;
  // § citizen-access เป็นเจ้าของ tx — helper ไม่เปิด tx เอง (กันซ้อนกับ withdrawConsent ของ c6)
  // audit ล้ม = revoke rollback ด้วย
  if (db) {
    await revokeConsentWithAudit(withdrawal, db);
  } else {
    await _db.transaction(async (tx) => {
      await revokeConsentWithAudit(withdrawal, tx);
    });
  }
  return { ok: true };
}

/** คืน null เมื่อพิสูจน์ได้ว่าเป็นเจ้าของ ไม่งั้นคืนเหตุผล (ใช้ใน audit เท่านั้น) */
async function ownershipDenial(
  db: DbOrTx,
  ownerId: string,
  proof: OwnershipProof,
): Promise<DenialReason | null> {
  if (proof.kind === 'line') {
    const owned = await firstOrUndefined(
      db
        .select({ id: lineUsers.id })
        .from(lineUsers)
        .where(and(eq(lineUsers.lineUserId, proof.lineUserId), eq(lineUsers.linkedUserId, ownerId)))
        .limit(1),
    );
    return owned ? null : 'not_case_owner_line';
  }

  // § ตัวตนของผู้แจ้งทางเว็บผูกกับ HMAC ของ CID เสมอ (ดู resolveCitizen) — email ที่กรอกไม่ใช่ identity key
  const owner = await firstOrUndefined(
    db.select({ email: users.email }).from(users).where(eq(users.id, ownerId)).limit(1),
  );
  if (!owner) return 'submitter_missing';
  return owner.email === cidPlaceholderEmail(proof.cid) ? null : 'cid_mismatch';
}
```

- [ ] **Step 4: export จาก `index.ts`**

ต่อท้าย `src/lib/cases/citizen-access/index.ts`:

```ts
export { withdrawCaseConsent, type OwnershipProof, type WithdrawResult } from './withdraw';
```

- [ ] **Step 5: รัน test ให้ผ่าน**

Run: `npx vitest run src/lib/cases/citizen-access/withdraw.integration.test.ts`
Expected: PASS 5 tests

- [ ] **Step 6: ทำ route ให้บาง**

แทนทั้งไฟล์ `src/app/api/consent/withdraw/route.ts`:

```ts
/**
 * POST /api/consent/withdraw — ประชาชนถอนความยินยอม PDPA
 *
 * Body: { trackingCode, cid } (เว็บ) หรือ { trackingCode } + liff session cookie (LINE)
 * การพิสูจน์ความเป็นเจ้าของ / revoke / audit อยู่ใน citizen-access (withdrawCaseConsent)
 *
 * หลังถอน: เรื่องจะไม่แสดงในทุกช่องทาง (ติดตามเรื่องทางเว็บ / บอท LINE / เรื่องของฉันใน LIFF)
 *
 * Rate limit: 5 requests / 10 นาที per IP (กัน abuse)
 */

import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit/enforce';
import { clientIpFromHeaders } from '@/lib/rate-limit/client-ip';
import { withdrawCaseConsent, type OwnershipProof } from '@/lib/cases/citizen-access';
import { consentWithdrawSchema, consentWithdrawLineSchema, validateOrError } from '@/lib/validation';
import { LIFF_SESSION_COOKIE, readLiffSessionValue } from '@/lib/liff/session';

// § คำตอบเดียวสำหรับ "ไม่พบเคส" / "มีเคสแต่ CID ไม่ตรง" / "ไม่มี user row" / "LINE ไม่ใช่เจ้าของ"
// เดิมแยก 404 กับ 403 ทำให้บอกได้ว่า tracking code ไหนมีอยู่จริงโดยไม่ต้องรู้ CID
// (เป็น enumeration oracle) — GET /api/cases/[id] ตั้งใจคืน 404 เหมือนกันหมดอยู่แล้ว
// ที่นี่จึงต้องเดินตามแบบเดียวกัน
const WITHDRAW_DENIED = { error: 'ไม่พบเรื่องที่ระบุ หรือข้อมูลไม่ตรงกับเจ้าของเรื่อง' };

export async function POST(req: NextRequest) {
  const ip = clientIpFromHeaders(req.headers);

  // § Rate limit — 5 requests / 10 minutes (ถี่เกินไป = น่าสงสัย)
  // failOpen: false — endpoint นี้ยืนยันตัวตนด้วย trackingCode + CID และทำงานทำลายข้อมูล
  // (ถอนความยินยอม) ถ้า Redis ล่มแล้วปล่อยผ่าน = เดา CID ได้ไม่จำกัด นับเป็น auth path
  // (บังคับที่ RATE_LIMIT_POLICIES.consentWithdraw — c7 merge ก่อนเสมอ)
  // ทำ c1 เดี่ยวชั่วคราว: const rateLimit = await checkRateLimit(`rate:consent-withdraw:${ip}`, 5, 600, { failOpen: false });
  const rateLimit = await enforceRateLimit('consentWithdraw', ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'ส่งคำขอถี่เกินไป กรุณารอ ' + rateLimit.reset + ' วินาที' },
      { status: 429 },
    );
  }

  // § Parse + validate body ด้วย zod
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // § ทางถอนแบบ LIFF — ผู้ใช้ที่แจ้งผ่าน LINE ไม่มี CID ในระบบ (D1) จึงยืนยันความ
  // เป็นเจ้าของเคสด้วย liff session cookie แทน
  const liffSession = readLiffSessionValue(req.cookies.get(LIFF_SESSION_COOKIE)?.value);
  let trackingCode: string;
  let proof: OwnershipProof;
  if (liffSession) {
    const validation = validateOrError(consentWithdrawLineSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    trackingCode = validation.data.trackingCode;
    proof = { kind: 'line', lineUserId: liffSession.lineUserId };
  } else {
    const validation = validateOrError(consentWithdrawSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    trackingCode = validation.data.trackingCode;
    proof = { kind: 'cid', cid: validation.data.cid };
  }

  const result = await withdrawCaseConsent(trackingCode, proof, {
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') || undefined,
  });
  if (!result.ok) {
    return NextResponse.json(WITHDRAW_DENIED, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    message: 'ถอนความยินยอมเรียบร้อย — ข้อมูลของคุณจะไม่สามารถเข้าถึงได้ผ่านระบบติดตามเรื่อง',
  });
}
```

- [ ] **Step 7: ให้ mock consent ใน `intake.test.ts` ครบ export ที่ module ใช้**

`intake.ts` import `./citizen-access` (index) ซึ่งตอนนี้ดึง `withdraw.ts` → `revokeConsent` มาด้วย แทน mock ใน `src/lib/cases/intake.test.ts`:

```ts
vi.mock('@/lib/consent', () => ({
  grantConsent: vi.fn(async () => undefined),
  CONSENT_VERSION: '1.0',
}));
```

ด้วย

```ts
vi.mock('@/lib/consent', () => ({
  grantConsent: vi.fn(async () => undefined),
  revokeConsent: vi.fn(async () => undefined),
  CONSENT_VERSION: '1.0',
}));
```

- [ ] **Step 8: รัน test ที่เกี่ยวข้องทั้งหมด**

Run: `npx vitest run src/lib/cases src/lib/line/bot`
Expected: PASS ทั้งหมด

- [ ] **Step 9: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/lib/cases src/app/api/consent`
Expected: exit 0

- [ ] **Step 10: Commit**

```bash
git add src/lib/cases/citizen-access/withdraw.ts src/lib/cases/citizen-access/index.ts src/lib/cases/citizen-access/withdraw.integration.test.ts src/app/api/consent/withdraw/route.ts src/lib/cases/intake.test.ts
git commit -m "refactor(citizen-access): move consent withdrawal ownership proof into withdrawCaseConsent"
```

---

### Task 9: script backfill ความยินยอมของผู้แจ้งผ่านบอทรุ่นเก่า

**Files:**
- Create: `scripts/backfill-bot-consent.ts`

**Interfaces:**
- Consumes: `CONSENT_VERSION` (`src/lib/consent.ts`), `generateId()`, schema `users` / `cases` / `consentRecords`
- Produces: CLI `npx tsx scripts/backfill-bot-consent.ts [--apply] [--verbose]`

> script ทำงานที่ top-level (แบบเดียวกับ `scripts/backfill-line-links.ts`) จึงไม่มี unit test — ตรวจด้วย fixture บน DB local ตาม Step 2–5

- [ ] **Step 1: เขียน script**

สร้าง `scripts/backfill-bot-consent.ts`:

```ts
/**
 * Backfill — บันทึกความยินยอม data_collection ให้ผู้แจ้งผ่านบอท LINE รุ่นเก่า
 * (แจ้งก่อน createCase เริ่มบันทึก consent via line_bot_submit — refactor/citizen-case-access)
 *
 * § ทำไมต้องมี: citizen-access ใช้กติกาเดียวทุกช่องทาง — "record data_collection ล่าสุด
 * ต้องเป็นการให้ความยินยอม" ไม่มี record เลย = มองไม่เห็นเรื่อง ผู้แจ้งผ่านบอทรุ่นเก่าไม่มี
 * record จึงหายจากทั้งเว็บ / บอท / เรื่องของฉัน จนกว่าจะรัน script นี้ด้วย --apply
 *
 * เลือกเฉพาะ users ที่:
 *   - email รูปแบบ placeholder สาย LINE (`line-%@placeholder.local`, ดู src/lib/line/placeholder-email.ts)
 *   - เป็นเจ้าของเรื่องอย่างน้อย 1 เรื่อง
 *   - ไม่มี consent_records data_collection เลยสักแถว
 * (คนที่เคยถอน = มีแถว revoke → ไม่แตะ / คนที่แจ้งผ่าน LIFF = มีแถว grant อยู่แล้ว)
 *
 * ไม่ concurrent-idempotent: NOT EXISTS ไม่ serialize กับ intake/withdraw ที่เริ่มก่อน commit
 * สอง backfill หรือ backfill ที่ชน grant/revoke อาจผ่าน NOT EXISTS ทั้งคู่ แล้ว insert grant
 * ด้วย now() ทำให้ consent ล่าสุดกลับเป็น granted ทั้งที่เพิ่งถอน
 * ข้อกำหนด: รัน --apply ใน maintenance window ที่ไม่มี intake/withdraw (ประกาศในขั้น deploy)
 * แล้วรัน query ตรวจผลหลัง apply — รันซ้ำตอนไม่มี writer พร้อมกันได้ (แถวที่มี record แล้วถูกตัด)
 *
 * รันด้วย: npx tsx scripts/backfill-bot-consent.ts [--apply] [--verbose]
 *   ไม่มี --apply = dry-run (แสดงผลอย่างเดียว ไม่เขียน DB)
 *   --verbose = พิมพ์รายแถว (default เงียบ — email ฝัง LINE userId)
 * § ลำดับ deploy: รัน --apply ทันทีหลัง deploy โค้ด citizen-access (รันก่อน deploy ไม่พอ —
 *   เรื่องที่แจ้งผ่านบอทระหว่างนั้นยังไม่มี consent)
 */

import { config } from 'dotenv';
import { and, eq, exists, like, notExists, sql } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db';
import { cases, consentRecords, users } from '../src/lib/db/schema';
import { CONSENT_VERSION } from '../src/lib/consent';
import { generateId } from '../src/lib/id';

config({ path: '.env.local', override: false });

const apply = process.argv.includes('--apply');
const verbose = process.argv.includes('--verbose');

const BACKFILL_METADATA = {
  via: 'backfill_bot_intake',
  basis: 'แจ้งเรื่องผ่านแชทบอท LINE ก่อนมีการบันทึกความยินยอมอัตโนมัติ',
};

const db = await getDb();

console.log(
  `🔏 Backfill ความยินยอมของผู้แจ้งผ่านบอท — ${apply ? 'APPLY' : 'DRY-RUN (ส่ง --apply เพื่อเขียนจริง)'}${verbose ? ' (verbose)' : ''}\n`
);

const candidates = await db
  .select({ id: users.id, email: users.email })
  .from(users)
  .where(
    and(
      like(users.email, 'line-%@placeholder.local'),
      exists(db.select({ id: cases.id }).from(cases).where(eq(cases.submittedBy, users.id))),
      notExists(
        db
          .select({ id: consentRecords.id })
          .from(consentRecords)
          .where(and(eq(consentRecords.userId, users.id), eq(consentRecords.consentType, 'data_collection'))),
      ),
    ),
  );

if (verbose) {
  for (const user of candidates) console.log(`  ✓ users ${user.id} (${user.email})`);
}

let writtenCount = 0;
if (apply && candidates.length > 0) {
  // § NOT EXISTS กันแถวซ้ำเมื่อรันซ้ำตอนไม่มี writer อื่น — ไม่กัน concurrent intake/withdraw
  // ต้องรัน --apply ใน maintenance window (ดูหัวไฟล์) แล้วตรวจด้วย query ใน Step 4
  // § postgres protocol จำกัด 65,535 params/statement (2 ต่อแถว ≈ 32k แถว) — ถ้ามากกว่านั้นให้ chunk ก่อน
  const result = await db.execute(sql`
    INSERT INTO consent_records (id, user_id, consent_type, version, is_granted, granted_at, metadata)
    SELECT v.id, v.user_id, 'data_collection', ${CONSENT_VERSION}, true, now(), ${JSON.stringify(BACKFILL_METADATA)}::jsonb
    FROM (VALUES ${sql.join(
      candidates.map((user) => sql`(${generateId()}::text, ${user.id}::text)`),
      sql`, `
    )}) AS v(id, user_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM consent_records c
      WHERE c.user_id = v.user_id AND c.consent_type = 'data_collection'
    )
    RETURNING id
  `);
  // postgres-js คืน RowList เป็น Array ตรง ๆ — length = จำนวนแถวที่เขียนจริง
  writtenCount = (result as unknown[]).length;
}

console.log(
  `\nสรุป: ผู้แจ้งผ่านบอทที่ยังไม่มีบันทึกความยินยอม ${candidates.length} ราย` +
    (apply ? ` — เขียนจริง ${writtenCount} แถว` : ' — dry-run ไม่ได้เขียน DB')
);

await closeDb();
```

- [ ] **Step 2: seed fixture บน DB local**

bash (Git Bash / WSL):

```bash
docker compose exec -T postgres psql -U postgres -d postgres <<'SQL'
INSERT INTO users (id, email, role, is_active, full_name) VALUES
  ('it-bf-user-1', 'line-Uitbackfill0001@placeholder.local', 'citizen', true, 'ผู้ใช้ LINE ทดสอบ backfill'),
  ('it-bf-user-2', 'line-Uitbackfill0002@placeholder.local', 'citizen', true, 'ผู้ใช้ LINE เคยถอนแล้ว');
INSERT INTO cases (id, title, description, location, category_id, submitted_by, tracking_code)
  SELECT 'it-bf-case-' || u.n, 'เรื่องทดสอบ backfill', 'รายละเอียด', 'ทดสอบ', c.id, 'it-bf-user-' || u.n, 'HG19999999' || u.n
  FROM (SELECT id FROM categories LIMIT 1) AS c CROSS JOIN (VALUES ('1'), ('2')) AS u(n);
INSERT INTO consent_records (id, user_id, consent_type, version, is_granted, revoked_at)
  VALUES ('it-bf-consent-2', 'it-bf-user-2', 'data_collection', '1.1', false, now());
SQL
```

Expected: `INSERT 0 2`, `INSERT 0 2`, `INSERT 0 1`

PowerShell (ไม่มี heredoc — เขียนไฟล์แล้ว pipe):

```powershell
@'
INSERT INTO users (id, email, role, is_active, full_name) VALUES
  ('it-bf-user-1', 'line-Uitbackfill0001@placeholder.local', 'citizen', true, 'ผู้ใช้ LINE ทดสอบ backfill'),
  ('it-bf-user-2', 'line-Uitbackfill0002@placeholder.local', 'citizen', true, 'ผู้ใช้ LINE เคยถอนแล้ว');
INSERT INTO cases (id, title, description, location, category_id, submitted_by, tracking_code)
  SELECT 'it-bf-case-' || u.n, 'เรื่องทดสอบ backfill', 'รายละเอียด', 'ทดสอบ', c.id, 'it-bf-user-' || u.n, 'HG19999999' || u.n
  FROM (SELECT id FROM categories LIMIT 1) AS c CROSS JOIN (VALUES ('1'), ('2')) AS u(n);
INSERT INTO consent_records (id, user_id, consent_type, version, is_granted, revoked_at)
  VALUES ('it-bf-consent-2', 'it-bf-user-2', 'data_collection', '1.1', false, now());
'@ | docker compose exec -T postgres psql -U postgres -d postgres
```

- [ ] **Step 3: dry-run**

Run: `npx tsx scripts/backfill-bot-consent.ts --verbose`
Expected: มีบรรทัด `✓ users it-bf-user-1 (line-Uitbackfill0001@placeholder.local)`, **ไม่มี** `it-bf-user-2`, บรรทัดสรุปลงท้าย `— dry-run ไม่ได้เขียน DB`

- [ ] **Step 4: apply แล้วรันซ้ำ (idempotent)**

Run: `npx tsx scripts/backfill-bot-consent.ts --apply`
Expected: `… เขียนจริง N แถว` โดย N เท่ากับจำนวนในสรุปของ Step 3

Run: `npx tsx scripts/backfill-bot-consent.ts`
Expected: จำนวนในสรุป **ลดลงเท่ากับแถวที่ Step 4 เขียน** (relative — shared DB อาจมีผู้แจ้งบอทอื่นที่ยังไม่มี record ห้ามคาด "0 ราย" ตายตัว) และ fixture `it-bf-user-1` ไม่อยู่ใน `--verbose`

query ตรวจผลหลัง apply (maintenance window — ไม่มี intake/withdraw คู่ขนาน):

```bash
docker compose exec -T postgres psql -U postgres -d postgres -c "select user_id, count(*) from consent_records where user_id like 'it-bf-user-%' and consent_type = 'data_collection' group by user_id;"
```

Expected: `it-bf-user-1` = 1 แถว grant, `it-bf-user-2` = 1 แถว revoke (ไม่เพิ่ม)

ตรวจว่า user ที่เคยถอนยังมีแค่แถว revoke:

```bash
docker compose exec -T postgres psql -U postgres -d postgres -c "select user_id, is_granted, metadata->>'via' as via from consent_records where user_id like 'it-bf-user-%' order by user_id;"
```

Expected: `it-bf-user-1 | t | backfill_bot_intake` และ `it-bf-user-2 | f |` (แถวเดียว)

- [ ] **Step 5: ล้าง fixture**

bash:

```bash
docker compose exec -T postgres psql -U postgres -d postgres <<'SQL'
DELETE FROM consent_records WHERE user_id LIKE 'it-bf-user-%';
DELETE FROM cases WHERE id LIKE 'it-bf-case-%';
DELETE FROM users WHERE id LIKE 'it-bf-user-%';
SQL
```

Expected: `DELETE 2`, `DELETE 2`, `DELETE 2`

PowerShell:

```powershell
@'
DELETE FROM consent_records WHERE user_id LIKE 'it-bf-user-%';
DELETE FROM cases WHERE id LIKE 'it-bf-case-%';
DELETE FROM users WHERE id LIKE 'it-bf-user-%';
'@ | docker compose exec -T postgres psql -U postgres -d postgres
```

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint scripts/backfill-bot-consent.ts`
Expected: exit 0

- [ ] **Step 7: Commit**

```bash
git add scripts/backfill-bot-consent.ts
git commit -m "chore(scripts): add backfill-bot-consent for legacy LINE bot submitters"
```

---

### Task 10: Gate ทั้งหมด + ส่ง PR

**Files:** ไม่มีการแก้โค้ด (ยกเว้น `graft/` ที่ `graft build` สร้างใหม่ ถ้ามีการเปลี่ยน)

- [ ] **Step 1: ตรวจว่าไม่มีใคร query เรื่องฝั่งประชาชนนอก module แล้ว**

รัน `graft build` ก่อน (index เก่าจะยังโชว์ linker ที่ลบไปแล้ว) แล้วค่อย:

Run: `graft grep "placeholder.local"`
Expected: ใน `src/` (ไม่นับ test) เหลือเฉพาะ `src/lib/cases/citizen-access/identity.ts`, `src/lib/line/placeholder-email.ts` และคอมเมนต์ใน `src/lib/cid-hmac.ts` — **ไม่มี** `src/app/api/consent/withdraw/route.ts`, `src/app/api/liff/session/route.ts`, `src/lib/cases/intake.ts`

Run: `graft grep "hasConsent("`
Expected: ไม่มีผู้เรียกใน `src/app` หรือ `src/lib/line` (เหลือแค่นิยามใน `src/lib/consent.ts`)

- [ ] **Step 2: Typecheck + lint เฉพาะไฟล์ที่แตะ**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

Run: `npx eslint src/lib/cases src/app/api/cases src/app/api/consent src/app/api/liff src/app/track src/lib/line/bot e2e/track-liff.spec.ts scripts/backfill-bot-consent.ts`
Expected: 0 problems ในไฟล์เหล่านี้

ห้ามอ้าง `npx eslint .` exit 0 — baseline ของ repo คือ 21 errors / 3 warnings ที่ไม่เกี่ยวกับแผนนี้ gate = ไม่เพิ่ม error ใหม่ (eslint เฉพาะไฟล์ที่แตะต้อง 0) + tsc + vitest

- [ ] **Step 3: Vitest ทั้งหมด (รวม integration + contrast gate)**

Run: `npx vitest run`
Expected: ทุกไฟล์ PASS — รวม `citizen-access/*.integration.test.ts` (3 ไฟล์), `intake.integration.test.ts`, `tokens.contrast.test.ts`

- [ ] **Step 4: E2E ที่ต้องเขียว**

terminal แยกต้องตั้ง env เดียวกันกับที่รัน playwright (Playwright `webServer` ใช้ `pnpm dev` ซึ่งค้าง — เปิดเองให้ `reuseExistingServer` จับ และตรวจว่า server เดิมเปิด LIFF mock จริงก่อน reuse):

```bash
# bash
LIFF_E2E_MOCK=1 npx next dev
# PowerShell
$env:LIFF_E2E_MOCK = '1'; npx next dev
```

Run:

```bash
# bash
LIFF_E2E_MOCK=1 npx playwright test e2e/track.spec.ts e2e/track-liff.spec.ts e2e/intake-liff.spec.ts
# PowerShell
$env:LIFF_E2E_MOCK = '1'; npx playwright test e2e/track.spec.ts e2e/track-liff.spec.ts e2e/intake-liff.spec.ts
```
Expected: ทั้ง 3 spec passed (intake-liff 3 tests, track-liff 2, track 4)

- [ ] **Step 5: อัปเดต graft index (ถ้า Step 1 ยังไม่ได้ build หลังแก้โค้ดสุดท้าย ให้ build อีกครั้ง)**

Run: `graft build`
Expected: build สำเร็จ; ถ้า `git status --short graft/` มีการเปลี่ยน ให้ commit:

```bash
git add graft
git commit -m "chore(graft): rebuild index for citizen-access module"
```

- [ ] **Step 6: Push + PR**

```bash
git push -u origin refactor/citizen-case-access
gh pr create --title "refactor(citizen-access): one module and one consent rule for citizen case access" --body "$(cat <<'EOF'
## สรุป
- module ใหม่ `src/lib/cases/citizen-access/` (interface: resolveCitizen, recordIntakeConsent, findTrackableCase, listMyCases, withdrawCaseConsent) ตามการ์ด c1 ใน architecture review 2026-10-03
- กติกาความยินยอมเดียวทุกช่องทาง: record data_collection ล่าสุดต้องเป็นการให้ความยินยอม — บอท LINE และ "เรื่องของฉัน" (LIFF) ซ่อนเรื่องที่เจ้าของถอนความยินยอมแล้ว (เดิมบอทโชว์ได้)
- แจ้งเรื่องผ่านบอทบันทึกความยินยอม (via line_bot_submit) + ข้อความแจ้งในสรุปก่อน "ยืนยัน"
- รวมตัวผูก LINE↔users สองตัว (resolveSubmitter, linkLineIdentity) เป็นตัวเดียว; placeholder email ของ CID อยู่ที่เดียว
- script `scripts/backfill-bot-consent.ts` สำหรับผู้แจ้งผ่านบอทรุ่นเก่า

## ⚠️ ลำดับ deploy
หลัง deploy production ให้ประกาศ maintenance window ที่ไม่มี intake/withdraw แล้วรัน `npx tsx scripts/backfill-bot-consent.ts` (dry-run ดูจำนวน) แล้ว `--apply` **ใน window นั้น** ตามด้วย query ตรวจว่าแต่ละ user ได้แถวเดียว — ก่อนรัน เรื่องที่แจ้งผ่านบอทรุ่นเก่าจะไม่พบทั้งเว็บ/บอท/LIFF NOT EXISTS ไม่กัน writer คู่ขนาน

## Test plan
- [ ] `npx tsc --noEmit` + `npx eslint` เฉพาะไฟล์ที่แตะ = 0 (ห้ามติ๊ก `eslint .` exit 0 — baseline 21 errors / 3 warnings)
- [ ] `npx vitest run` (integration กับ Postgres/Redis local)
- [ ] `LIFF_E2E_MOCK=1 npx playwright test e2e/track.spec.ts e2e/track-liff.spec.ts e2e/intake-liff.spec.ts`
- [ ] backfill dry-run / apply / rerun บน fixture local (expected แบบ relative + query ตรวจหลัง apply)
- [ ] Vercel preview: ติดตามเรื่องทางเว็บ + "ติดตาม HG…" ในบอท + เรื่องของฉันใน LIFF
- [ ] production: รัน backfill --apply หลัง deploy
EOF
)"
```

Expected: URL ของ PR; ไม่มี GitHub Actions run (ตั้งใจปิดไว้) — gate จริงคือ local + Vercel preview

---

## Self-Review

**1. Spec coverage (การ์ด c1 + การตัดสินใจของผู้ใช้):**

| ข้อกำหนด | Task |
|---|---|
| web tracking route บาง: consent + audit + PII อยู่ใน module, rate limit คงที่ route | 5, 6 |
| บอท `trackCase` เช็คความยินยอม + audit | 5 (`findTrackableCase` channel `line_bot`), 7 |
| LIFF `getMyCases` ซ่อนเรื่องที่ถอนแล้ว (กติกาเดียว) | 5 (`listMyCases`), 6 |
| audit เฉพาะค้นเลขติดตามแบบไม่ล็อกอิน — `listMyCases` ไม่เขียน audit (ผู้ดูคือเจ้าของ LIFF) | 5 (docblock + test "ไม่เขียน audit") |
| ฟังก์ชันแตะ DB รับ `DbOrTx`; identity ใช้ ON CONFLICT ไม่ catch-ใน-tx | 1, 3, 5, 8 + constraint c6 |
| withdraw atomic: module เป็นเจ้าของ tx เรียก `revokeConsentWithAudit` | 8 |
| rate limit เรียก `enforceRateLimit` (c7 merge ก่อน) | 6, 8 |
| `intake.integration.test.ts` เป็นของ c6 — แผนนี้ต่อท้าย | 3, 5 |
| backfill: maintenance window ไม่ใช่ concurrent-idempotent; latest = created_at DESC, id DESC; grant ระดับ user ทำให้เรื่องเก่ากลับมา | 5, 9 |
| consent/withdraw: พิสูจน์ความเป็นเจ้าของสองแบบอยู่ใน module, ไม่สร้าง `cid-<hash>@placeholder.local` เองที่ route | 1 (`cidPlaceholderEmail`), 8 |
| placeholder CID ที่ intake.ts:232 ย้ายเข้า module | 1, 2 |
| ตัวผูก LINE→users สองตัวรวมเป็นตัวเดียว | 1, 2 |
| บอทบันทึก consent ตอนแจ้ง + ข้อความแจ้งใน case-flow ก่อน/ตอนยืนยัน | 3, 4 |
| backfill dry-run default + `--apply` ตามแบบ backfill-line-links | 9 |
| ถอนแล้วซ่อนทุกช่องทาง รวมบอทและ LIFF | 5 (test `§ ถอนความยินยอมแล้ว`), 8 (test สำเร็จ) |
| integration test ที่ interface + ลบ test ตื้นที่ซ้ำ | 1, 5, 8 (สร้าง); 2 (ลบ describe ตัวตนเว็บใน intake.test), 6 (ลบ my-cases.test) |
| e2e track / track-liff / intake-liff เขียว | 6 (seed consent ใน track-liff), 10 |
| Task 0 แตก branch จาก main | 0 |

**2. Placeholder scan:** ไม่มี "TBD/TODO/implement later/handle edge cases"; ทุก code step มีโค้ดจริง; คำสั่งรันมี expected output ทุกขั้น

**3. Type consistency:** `CitizenIdentity` (Task 1) ใช้ใน Task 2 ด้วยฟิลด์ `fullName/phoneNumber/contactEmail` และ `lineUserId/fullName/profile/source` ตรงกัน; `IntakeConsentVia` มีค่า `'intake_submit' | 'liff_submit' | 'line_bot_submit'` ตรงกับ `intakeConsentVia()` และ test; `ViewContext.channel` = `'web' | 'line_bot'` ใช้ตรงกันใน route (Task 6), engine (Task 7), tests; `TrackedCaseView.case.trackingCode` ใช้ใน engine และ mock ของ engine.test; `withdrawCaseConsent(rawCode, proof, ctx, db?)` ตรงกันใน route และ test; พารามิเตอร์ `db?` ของทุกฟังก์ชันที่แตะ DB เป็น `DbOrTx` ไม่ใช่ `Db`; `consentActiveFor` ใช้ภายใน module เท่านั้น (ไม่อยู่ใน index); `cidPlaceholderEmail` export จาก identity.ts แต่ไม่อยู่ใน index — ใช้เฉพาะ withdraw.ts; `revokeConsentWithAudit` ชื่อ/ฟิลด์ตรงกับ helper ในแผน c6
