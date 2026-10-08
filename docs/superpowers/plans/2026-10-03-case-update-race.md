# Case Update Race (applyCaseUpdate row lock) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้ `applyCaseUpdate` รับประกันจริงว่าทุกการเปลี่ยนสถานะผ่าน `assertTransition` จากสถานะ *ล่าสุด* ของแถว แม้มีผู้เขียนสองรายพร้อมกัน (เจ้าหน้าที่สองคน หรือเจ้าหน้าที่กับ cron `close-stale`)

**Architecture:** ย้ายการอ่าน `current` + `buildTimeline` (ซึ่งเรียก `assertTransition`) เข้าไปอยู่ใน `db.transaction` เดียวกับการเขียน และล็อกแถวด้วย `SELECT … FOR UPDATE` (Drizzle `.for('update')`) ผู้เขียนรายที่สองจะรอจนรายแรก commit แล้วอ่านสถานะใหม่ (Postgres READ COMMITTED + row lock จะคืน row version ล่าสุดหลังรอ) จึงถูก `assertTransition` ปฏิเสธด้วยเหตุผลภาษาไทยตามปกติ signature และ return type ของ `applyCaseUpdate` ไม่เปลี่ยน ดังนั้น 6 caller (`src/app/admin/actions/cases.ts` ×5, `src/app/api/cron/close-stale/route.ts` ×1) ไม่ต้องแก้

**Tech Stack:** Next.js 16, TypeScript, Drizzle ORM 0.45.2 + postgres-js 3.4 (pool `max: 10`), PostgreSQL 17 (local docker :5433), Vitest 3

**Spec:** `project-log-md/architecture-review/2026-10-03/architecture-review-20261003-205746.html` — การ์ด `id="c2"` ("ให้ module อัปเดตเรื่องรับประกัน transition จริง")

## Global Constraints

- ใช้ `npx` แทน `pnpm` ทุกคำสั่ง (`pnpm` ค้างใน environment นี้)
- ห้ามเปลี่ยน signature: `applyCaseUpdate(caseId: string, patch: CasePatch, actor: CaseActor): Promise<CaseOperationResult>` และ `CaseOperationResult = { ok: true } | { ok: false; error: string }`
- ห้ามแก้ caller ทั้ง 6 จุด (`src/app/admin/actions/cases.ts`, `src/app/api/cron/close-stale/route.ts`)
- ห้ามเพิ่ม dependency ใหม่ — `drizzle-orm@0.45.2` มี `for(strength: LockStrength, config?: LockConfig)` บน PgSelect แล้ว (ตรวจที่ `node_modules/drizzle-orm/pg-core/query-builders/select.d.ts:586`, `LockStrength = 'update' | 'no key update' | 'share' | 'key share'`)
- comment ในโค้ดเป็นภาษาไทย; comment ที่อธิบายการตัดสินใจที่ไม่ชัดเจนให้ขึ้นต้นด้วย `§`; ห้ามลบ `§` comment เดิม (`SYSTEM_ACTOR`, `buildTimeline`, privacy invariant ของ assignment/department)
- ข้อความ error ที่ผู้ใช้เห็นต้องเป็นภาษาไทยและคงข้อความเดิม: `'ไม่พบเรื่องที่ระบุ'`, `'เกิดข้อผิดพลาดในการบันทึก กรุณาลองอีกครั้ง'`, และ reason จาก `assertTransition`
- test เดิม `src/lib/cases/operations.test.ts` และ `src/lib/cases/operations.integration.test.ts` ต้องผ่านทั้งหมดโดยไม่แก้ assertion เดิม
- integration test ต้องมี Docker stack: `docker compose up -d postgres redis up-redis` (Postgres host :5433; up-redis host port อ่านจาก `UPREDIS_HOST_PORT` ใน `.env` — เครื่องนี้ตั้ง 8081, default 8080 — ค่า URL ที่ test ใช้จริงมาจาก `UPSTASH_REDIS_REST_URL` ใน `.env.local` ห้าม hardcode พอร์ต)
- ทำงานบน branch `fix/case-update-race` เท่านั้น; GitHub Actions ปิดอยู่โดยตั้งใจ — gate จริงคือ local (`tsc`, `eslint`, `vitest`) + Vercel Preview
- commit แบบ conventional commits (`fix(cases): …`, `test(cases): …`)

---

## File Structure

| ไฟล์ | การเปลี่ยนแปลง | ความรับผิดชอบ |
|---|---|---|
| `src/lib/cases/operations.ts` | Modify `:55-114` (`applyCaseUpdate`) | อ่าน + ตรวจ + เขียนใน transaction เดียวพร้อม row lock |
| `src/lib/cases/operations.integration.test.ts` | Modify `:1-32` (import + `createTestCase` รับ `CaseStatus`), เพิ่ม `describe` ใหม่ท้ายไฟล์ | test concurrency ที่ระดับ interface |

ไม่มีไฟล์ใหม่ ไม่มี migration (row lock ไม่ต้องเปลี่ยน schema)

---

### Task 0: เตรียม branch

**Files:** ไม่มี

**Interfaces:**
- Consumes: ไม่มี
- Produces: branch `fix/case-update-race` แตกจาก `main` ล่าสุด

- [ ] **Step 1: สลับไป main ล่าสุดแล้วแตก branch**

working tree ปัจจุบันมีไฟล์ untracked/modified ที่ไม่เกี่ยวข้อง (`.gitignore`, `AGENTS.md`, `next-env.d.ts`, `.claude/…` ฯลฯ) — ถ้า `git checkout main` ปฏิเสธเพราะจะทับไฟล์ ให้ `git stash push -u -m "pre-case-update-race"` ก่อน แล้วค่อย `git stash pop` หลังจบงาน (อย่า commit ไฟล์เหล่านั้นลง branch นี้)

```bash
git checkout main && git pull && git checkout -b fix/case-update-race
```

Expected: `Switched to a new branch 'fix/case-update-race'`

- [ ] **Step 2: ยก Docker stack และยืนยันว่า integration test เดิมผ่านก่อนแตะโค้ด (baseline)**

```bash
docker compose up -d postgres redis up-redis
npx drizzle-kit push
npx vitest run src/lib/cases/operations.integration.test.ts src/lib/cases/operations.test.ts
```

Expected: ทุก test PASS (integration 12 tests + unit tests ของ `buildTimeline`) — ถ้า baseline ไม่ผ่าน หยุดและแก้ environment ก่อน (มักเป็น Docker ไม่ได้รัน หรือ `.env.local` ไม่มี `DATABASE_URL`)

---

### Task 1: ปิด race ใน `applyCaseUpdate` ด้วย row lock (TDD)

**Files:**
- Modify: `src/lib/cases/operations.ts:55-114`
- Test: `src/lib/cases/operations.integration.test.ts` (แก้ `:1-32`, เพิ่ม describe ใหม่ท้ายไฟล์หลัง `:236`)

**Interfaces:**
- Consumes: `applyCaseUpdate`, `SYSTEM_ACTOR`, `CaseActor` จาก `./operations`; `CaseStatus` จาก `./state-machine`; `firstOrUndefined<T>(rows: Promise<T[]>): Promise<T | undefined>` จาก `../db/query-helpers`; `logAudit(entry, db?: DbOrTx)` จาก `../audit`
- Produces: `applyCaseUpdate(caseId: string, patch: CasePatch, actor: CaseActor): Promise<CaseOperationResult>` — signature เดิมทุกตัวอักษร แต่ตอนนี้ serialize ผู้เขียนต่อแถว `cases.id`

- [ ] **Step 1: ให้ `createTestCase` รับทุก `CaseStatus`**

ใน `src/lib/cases/operations.integration.test.ts` เพิ่ม import (ต่อจากบรรทัด 6):

```ts
import type { CaseStatus } from './state-machine';
```

แล้วแก้ signature ของ `createTestCase` (บรรทัด 18) จาก

```ts
async function createTestCase(status: 'pending' | 'received' | 'in_progress' | 'done' = 'pending') {
```

เป็น

```ts
async function createTestCase(status: CaseStatus = 'pending') {
```

(body เดิมไม่เปลี่ยน — `cases.status` เป็น pgEnum ที่ derive จาก `ALL_STATUSES` จึงรับ `CaseStatus` ได้ทุกค่า)

- [ ] **Step 2: เขียน test concurrency ที่ fail (ต่อท้ายไฟล์)**

เพิ่มท้าย `src/lib/cases/operations.integration.test.ts`:

```ts
/**
 * § race ระหว่างผู้เขียนสองราย — เดิม applyCaseUpdate อ่านสถานะนอก transaction
 * แล้ว UPDATE โดยกรองแค่ id ทำให้ทั้งสองฝ่ายผ่าน assertTransition จากสถานะเดิม
 * (เช่น reviewing→rejected กับ reviewing→assigned) แล้วจบที่ rejected→assigned ซึ่งผิดกติกา
 * รันหลายรอบเพราะ race เป็นเรื่องจังหวะ — รอบเดียวอาจบังเอิญไม่ชน
 */
const RACE_ROUNDS = 5;

interface RaceSide {
  newStatus: CaseStatus;
  actor: CaseActor;
}

interface RaceScenario {
  name: string;
  initial: CaseStatus;
  a: RaceSide;
  b: RaceSide;
}

// ทั้งสองคู่ถูกเลือกให้ "ใครชนะก่อน อีกฝ่ายต้องถูกปฏิเสธ" ตาม ALLOWED_TRANSITIONS
const RACE_SCENARIOS: RaceScenario[] = [
  {
    name: 'two staff: reviewing → rejected vs reviewing → assigned',
    initial: 'reviewing',
    a: { newStatus: 'rejected', actor: ACTOR },
    b: { newStatus: 'assigned', actor: SUPERVISOR },
  },
  {
    name: 'cron vs staff: done → closed vs done → in_progress',
    initial: 'done',
    a: { newStatus: 'closed', actor: SYSTEM_ACTOR },
    b: { newStatus: 'in_progress', actor: ACTOR },
  },
];

describe('applyCaseUpdate — concurrent writers', () => {
  test.each(RACE_SCENARIOS)('$name — exactly one wins and timeline stays consistent', async ({ initial, a, b }) => {
    const db = await getDb();

    for (let round = 0; round < RACE_ROUNDS; round++) {
      const id = await createTestCase(initial);

      const [resultA, resultB] = await Promise.all([
        applyCaseUpdate(id, { kind: 'status', newStatus: a.newStatus, isPublic: true }, a.actor),
        applyCaseUpdate(id, { kind: 'status', newStatus: b.newStatus, isPublic: true }, b.actor),
      ]);

      const results = [resultA, resultB];
      expect(results.filter((r) => r.ok), `round ${round}: winners`).toHaveLength(1);

      // ฝ่ายแพ้ต้องถูกปฏิเสธโดย assertTransition (เหตุผลภาษาไทย) ไม่ใช่ error การบันทึกทั่วไป
      const loser = results.find((r) => !r.ok);
      expect(loser).toBeDefined();
      if (loser && !loser.ok) {
        expect(loser.error, `round ${round}: loser reason`).toMatch(/ไม่สามารถเปลี่ยน/);
      }

      const winnerStatus = resultA.ok ? a.newStatus : b.newStatus;
      expect((await getCase(id)).status, `round ${round}: final status`).toBe(winnerStatus);

      const statusChanges = (await getTimeline(id)).filter((u) => u.updateType === 'status_change');
      expect(statusChanges, `round ${round}: timeline`).toHaveLength(1);
      expect(statusChanges[0]).toMatchObject({ oldValue: initial, newValue: winnerStatus });

      const audits = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, id));
      expect(audits.filter((row) => row.action === 'update_case_status'), `round ${round}: audit`).toHaveLength(1);
    }
  });

  test('non-conflicting concurrent updates (status + comment) both succeed — lock serializes, not rejects', async () => {
    const id = await createTestCase('received');

    const [statusResult, commentResult] = await Promise.all([
      applyCaseUpdate(id, { kind: 'status', newStatus: 'reviewing', isPublic: true }, ACTOR),
      applyCaseUpdate(id, { kind: 'comment', comment: 'บันทึกระหว่างตรวจสอบ', isPublic: false }, SUPERVISOR),
    ]);

    expect(statusResult).toEqual({ ok: true });
    expect(commentResult).toEqual({ ok: true });
    expect((await getCase(id)).status).toBe('reviewing');

    const timeline = await getTimeline(id);
    expect(timeline).toHaveLength(2);
    expect(timeline.map((u) => u.updateType).sort()).toEqual(['comment', 'status_change']);
  });
});
```

หมายเหตุ: `eq`, `auditLogs`, `getDb`, `SYSTEM_ACTOR`, `CaseActor` import อยู่แล้วที่บรรทัด 1-6; ข้อมูลที่สร้างถูกลบใน `afterAll` เดิมผ่าน `createdCaseIds` (ลบ `caseUpdates`, `auditLogs`, `cases`) จึงไม่ต้องเพิ่ม cleanup

- [ ] **Step 3: รัน test เพื่อยืนยันว่า fail**

```bash
npx vitest run src/lib/cases/operations.integration.test.ts -t "concurrent writers"
```

Expected: FAIL อย่างน้อยหนึ่ง scenario ด้วยข้อความลักษณะ
`AssertionError: round 0: winners: expected [ { ok: true }, { ok: true } ] to have a length of 1 but got 2`
(test "non-conflicting … both succeed" อาจ PASS ตั้งแต่ตอนนี้ — ถูกต้อง เพราะมันเป็น regression guard ว่า lock ไม่ทำให้งานที่ไม่ชนกันล้ม)

ถ้าทั้งสอง scenario PASS ก่อนแก้ (race ไม่เกิดเพราะจังหวะ) ให้เพิ่ม `RACE_ROUNDS` ชั่วคราวเป็น `20` แล้วรันใหม่เพื่อยืนยัน RED จากนั้นคืนค่าเป็น `5` ก่อน commit — ห้ามข้ามขั้น RED โดยไม่ได้เห็น failure จริง

- [ ] **Step 4: แก้ `applyCaseUpdate` ให้อ่าน-ตรวจ-เขียนใน transaction เดียวพร้อม row lock**

ใน `src/lib/cases/operations.ts` แทนที่ทั้งฟังก์ชัน (บรรทัด 55-114) ด้วย:

```ts
export async function applyCaseUpdate(
  caseId: string,
  patch: CasePatch,
  actor: CaseActor,
): Promise<CaseOperationResult> {
  const perm = checkPermission(actor.role, patch);
  if (!perm.ok) return { ok: false, error: perm.reason! };

  const db = await getDb();

  try {
    return await db.transaction(async (tx): Promise<CaseOperationResult> => {
      /**
       * § อ่าน + ตรวจ + เขียน ต้องอยู่ใน transaction เดียวและล็อกแถว (SELECT … FOR UPDATE)
       *
       * เดิมอ่าน current นอก transaction แล้ว UPDATE โดยกรองแค่ id — ผู้เขียนสองราย
       * (เจ้าหน้าที่สองคน หรือเจ้าหน้าที่กับ cron close-stale) อ่านได้สถานะเดิมพร้อมกัน
       * ผ่าน assertTransition ทั้งคู่ แล้วจบที่ transition ผิดกติกา เช่น rejected → assigned
       *
       * row lock ทำให้รายที่สองรอจนรายแรก commit แล้วอ่านสถานะล่าสุด (READ COMMITTED
       * คืน row version ใหม่หลังรอ lock) จึงถูก assertTransition ปฏิเสธด้วยเหตุผลภาษาไทยตามปกติ
       * ล็อกทุก patch kind ไม่ใช่แค่ status — priority ("เหมือนเดิม") และ oldValue ของ
       * assignment/department ก็อ่านจาก current เหมือนกัน
       */
      const current = await firstOrUndefined(
        tx
          .select({
            id: cases.id,
            status: cases.status,
            priority: cases.priority,
            assignedTo: cases.assignedTo,
            departmentId: cases.departmentId,
            title: cases.title,
          })
          .from(cases)
          .where(eq(cases.id, caseId))
          .limit(1)
          .for('update')
      );

      // คืน error จากใน callback (ไม่ throw) — tx commit แบบไม่มีการเขียน และปล่อย lock ทันที
      if (!current) return { ok: false, error: 'ไม่พบเรื่องที่ระบุ' };

      const timeline = buildTimeline(patch, current);
      if ('error' in timeline) return { ok: false, error: timeline.error };

      const updateSet = buildUpdateSet(patch, timeline);

      await tx.update(cases).set(updateSet).where(eq(cases.id, caseId));

      await tx.insert(caseUpdates).values({
        id: generateId(),
        caseId,
        userId: actor.userId,
        ...timeline.entry,
      });

      await logAudit({
        userId: actor.userId,
        action: PATCH_AUDIT_ACTIONS[patch.kind],
        resource: 'cases',
        resourceId: caseId,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        metadata: { title: current.title, ...timeline.auditMeta },
      }, tx);

      return { ok: true };
    });
  } catch (err) {
    console.error(`[applyCaseUpdate:${patch.kind}] failed`, err);
    return { ok: false, error: 'เกิดข้อผิดพลาดในการบันทึก กรุณาลองอีกครั้ง' };
  }
}
```

ไม่ต้องแก้ import (ใช้ `eq`, `getDb`, `firstOrUndefined`, `cases`, `caseUpdates`, `generateId`, `logAudit` ชุดเดิม) และไม่แตะ `buildTimeline` / `buildUpdateSet` / `checkPermission`

ข้อสังเกตเชิงพฤติกรรม: เดิม "ไม่พบเรื่อง" กับ transition ผิดกติกาคืนผลโดยไม่เปิด transaction; ตอนนี้เปิด transaction สั้น ๆ ที่ commit ว่าง — ผลลัพธ์ที่ caller เห็นเหมือนเดิมทุกกรณี

- [ ] **Step 5: รัน test concurrency ให้ผ่าน**

```bash
npx vitest run src/lib/cases/operations.integration.test.ts -t "concurrent writers"
```

Expected: PASS ทั้ง 3 test (2 scenario × 5 รอบ + non-conflicting)

- [ ] **Step 6: รัน test เดิมทั้งสองไฟล์เพื่อยืนยันว่าไม่มี regression**

```bash
npx vitest run src/lib/cases/operations.integration.test.ts src/lib/cases/operations.test.ts
```

Expected: PASS ทั้งหมด รวม `unknown case id returns ไม่พบเรื่องที่ระบุ`, `invalid transition pending → done is rejected and writes nothing`, `same priority is rejected without writes` (กรณีที่ตอนนี้ return จากใน transaction)

- [ ] **Step 7: typecheck + lint เฉพาะจุด**

```bash
npx tsc --noEmit
npx eslint src/lib/cases/operations.ts src/lib/cases/operations.integration.test.ts
```

Expected: ไม่มี output error (exit code 0)

- [ ] **Step 8: Commit**

```bash
git add src/lib/cases/operations.ts src/lib/cases/operations.integration.test.ts
git commit -m "fix(cases): ล็อกแถวและตรวจ transition ใน transaction เดียวกับการเขียนใน applyCaseUpdate

เดิมอ่านสถานะนอก transaction แล้ว UPDATE WHERE id อย่างเดียว ผู้เขียนสองราย
(เจ้าหน้าที่สองคน หรือเจ้าหน้าที่กับ cron close-stale) ผ่าน assertTransition
จากสถานะเดิมพร้อมกันได้ เช่น reviewing→rejected กับ reviewing→assigned
ตอนนี้ใช้ SELECT ... FOR UPDATE ใน db.transaction — signature เดิม caller ไม่ต้องแก้
เพิ่ม integration test แบบ Promise.all ที่ interface"
```

---

### Task 2: Verification gates + PR

**Files:** ไม่มีการแก้โค้ด

**Interfaces:**
- Consumes: commit จาก Task 1 บน `fix/case-update-race`
- Produces: PR เข้า `main`

- [ ] **Step 1: รัน gate เต็มชุด**

```bash
npx tsc --noEmit
npx eslint .
npx vitest run
```

Expected: typecheck/lint ไม่มี error; vitest PASS ทั้งหมด (รวม `src/styles/tokens.contrast.test.ts` และ integration test ทุกไฟล์ — Docker stack ต้องรันอยู่)

- [ ] **Step 2: ตรวจ diff ว่าไม่มีการเปลี่ยนที่ไม่ตั้งใจ**

```bash
git diff main...HEAD --stat
```

Expected: มีแค่ 2 ไฟล์ — `src/lib/cases/operations.ts` และ `src/lib/cases/operations.integration.test.ts`; ไม่มีไฟล์ใน `src/app/admin/actions/` หรือ `src/app/api/cron/`

- [ ] **Step 3: Push และเปิด PR**

```bash
git push -u origin fix/case-update-race
gh pr create --base main --title "fix(cases): ปิด race ของ applyCaseUpdate ด้วย row lock" --body "## Summary
- \`applyCaseUpdate\` อ่าน + ตรวจ \`assertTransition\` + เขียน ใน \`db.transaction\` เดียว พร้อม \`SELECT ... FOR UPDATE\`
- ปิดกรณีผู้เขียนสองราย (staff×2 หรือ staff + cron close-stale) ผ่าน transition จากสถานะเดิมพร้อมกัน (เช่น rejected→assigned)
- signature/return type เดิม — 6 caller ไม่เปลี่ยน
- อ้างอิง: architecture review 2026-10-03 การ์ด #2

## Test plan
- [x] integration: สอง scenario × 5 รอบ (Promise.all) — ชนะได้รายเดียว, final status + timeline + audit สอดคล้อง
- [x] integration: status + comment พร้อมกันผ่านทั้งคู่ (lock serialize ไม่ใช่ reject)
- [x] test เดิมใน operations.test.ts / operations.integration.test.ts ผ่าน
- [x] npx tsc --noEmit, npx eslint ., npx vitest run
- [ ] Vercel Preview check เขียว"
```

Expected: `gh` พิมพ์ URL ของ PR; ไม่มี GitHub Actions run (ปิดโดยตั้งใจ) — รอเฉพาะ Vercel / Vercel Preview Comments

---

## Self-Review

1. **Spec coverage (การ์ด c2):** อ่าน current นอก tx (`operations.ts:65-78`) → ย้ายเข้า tx + `.for('update')` (Task 1 Step 4); `UPDATE WHERE id` (`:89`) → ปลอดภัยเพราะถือ lock ตั้งแต่อ่าน; interface เดิม/6 caller ไม่แก้ (Global Constraints + Task 2 Step 2); "integration test ไม่มีกรณีเขียนพร้อมกัน" → Task 1 Step 2 (staff×staff และ cron×staff ตาม sequence diagram ในการ์ด); ฝ่ายแพ้ "คืนเหตุผลภาษาไทย" → assertion `/ไม่สามารถเปลี่ยน/`
2. **Placeholder scan:** ทุก step มีโค้ด/คำสั่ง/expected output จริง ไม่มี TBD
3. **Type consistency:** `CaseStatus` (import จาก `./state-machine`) ใช้ทั้งใน `createTestCase`, `RaceSide`, `RaceScenario`; `CaseActor`/`SYSTEM_ACTOR`/`applyCaseUpdate` ตรงกับ export เดิมใน `operations.ts`; `firstOrUndefined` รับ query builder (thenable) แบบเดียวกับโค้ดเดิม; `.for('update')` ตรงกับ `LockStrength` ของ drizzle-orm 0.45.2
