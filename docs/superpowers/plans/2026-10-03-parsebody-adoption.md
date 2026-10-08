# parseBody Adoption (ทางเข้าเดียวของ route handler) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ `parseBody` ใน `src/lib/api-helpers.ts` เป็นทางเข้าเดียวของ route handler ที่รับ JSON body — เหลือ `try { await request.json() } catch` แบบเขียนเอง 0 จุดในขอบเขต (ยกเว้น 2 จุดที่ตั้งใจอธิบายไว้ใน Task 4/ข้อจำกัด) โดยไม่เปลี่ยน status code และข้อความ error แม้แต่ตัวเดียว

**Architecture:** `parseBody(schema, request)` มีอยู่แล้ว (`src/lib/api-helpers.ts:8-25`) คืน discriminated union `{ ok: true; data } | { ok: false; response }` ให้ early-return `result.response` — งานคือ (1) เขียน unit test ให้ก่อน (ตอนนี้ไม่มี test เลย) (2) ย้าย 14 route ที่ parse เอง (7 แบบ inline `safeParse` + `issues[0]?.message`, 7 แบบ `validateOrError`) เป็น 3 batch ตามแบบแผนของโค้ดเดิม (3) เขียน § comment อธิบายจุดที่ `callback` route ตั้งใจไม่ย้าย ไม่มี module ใหม่ ไม่มี schema ใหม่ ไม่แตะ `submit`/`withdraw`

**Tech Stack:** Next.js 16, TypeScript, Zod 4.4.3, Vitest 3

**Spec:** `project-log-md/architecture-review/2026-10-03/architecture-review-20261003-205746.html` — การ์ด `id="c8"` ("ให้ parseBody เป็นทางเข้าเดียวของ route handler")

## Global Constraints

- ใช้ `npx` แทน `pnpm` ทุกคำสั่ง (`pnpm` ค้างใน environment นี้)
- ทำงานบน branch `refactor/parsebody-adoption` เท่านั้น; GitHub Actions ปิดโดยตั้งใจ — gate จริงคือ `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` + Vercel Preview
- **ห้ามแตะ** `src/app/api/cases/submit/route.ts` และ `src/app/api/consent/withdraw/route.ts` — เลือก schema หลังอ่าน LIFF session cookie จึงใช้ `parseBody` ตรง ๆ ไม่ได้ (นอก scope ตามข้อตกลง)
- ห้ามแตะ `src/lib/api-helpers.ts` signature และ `src/lib/validation.ts` (`zodErrorToMessage`, `validateOrError`)
- ทุก route ที่ย้ายต้องคง status code และข้อความ error เดิม **ทุกตัวอักษร** — ดูตารางพฤติกรรมด้านล่าง ถ้าเจอจุดที่ต่างให้หยุดและรายงาน ห้ามเปลี่ยนข้อความเพื่อให้เข้ากับ `parseBody`
- **ข้อเท็จจริงที่ทำให้แผนนี้ทำได้โดยไม่เปลี่ยนข้อความ:** `zodErrorToMessage` (`src/lib/validation.ts:471-478`) คืน `error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง'` — **เหมือนกับที่ `parseBody` คืนทุกตัวอักษร** จึงย้าย route ทั้งแบบ inline `safeParse` และแบบ `validateOrError` ได้โดยข้อความ validation เท่าเดิม
- `parseBody` ทำแค่ 2 อย่าง: JSON พัง → `{ error: 'Invalid JSON' }` 400; schema ไม่ผ่าน → 400 + ข้อความ zod ตัวแรก — **เท่ากับโค้ดที่เขียนเองทั้ง 14 route** (ตรวจแล้วทีละไฟล์ในตาราง)
- คง `§` comment เดิมในทุกไฟล์ (โดยเฉพาะ `conversations/[id]` ที่มี § เยอะเรื่อง transfer/idempotency); comment ใหม่เป็นภาษาไทย
- **ชนกับ plan อื่น:** `src/app/api/line/admin/faq/[id]/route.ts` ถูก plan `audited-writes` แก้ส่วนเขียน (`:47-60`, `:80-89`) ในขณะที่ plan นี้แก้ส่วน parse (`:29-39`) — hunk คนละที่ ถ้า rebase แล้ว conflict ให้รวมทั้งสองฝั่ง ห้าม revert ของอีกฝั่ง (`git fetch origin` + อ่านไฟล์ใหม่ก่อนทำ Task 2 ถ้ามี commit จาก plan นั้นใน `origin/main`). **ใช้ `result.data` ภายใน tx ทั้ง update และ audit** ถ้า c6 ครอบ tx แล้ว — ห้ามเหลือ `parsed.data`
- **ชนกับ plan `conversation-module` (c4):** c4 เขียน PATCH `conversations/[id]/route.ts` ช่วง `:66-227` (ครอบ `:73-83`) และเขียน `conversations/[id]/messages/route.ts` ทั้งไฟล์ โดย snippet เดิมยังใช้ `validateOrError` + `request.json()`. **c4 ต้องใช้ `parseBody` และ merge หลังแผนนี้** — ถ้า c4 merge ทีหลังจะ revert 2 ไฟล์เงียบ ๆ และ gate `.json(` ของ Task 5 จะแดง. ห้ามรับ snippet c4 ที่คืน manual parse
- **ชนกับ plan `bot-config-module` (c5) ที่ `admin/settings/route.ts`:** c5 เข้ม schema (`:10-19`) และเปลี่ยนตัวเขียน (`:63-70`) ห่างจาก parse (`:51-60`) แค่ 2 บรรทัด → hunk เดียวกันตอน rebase. **schema เข้มของ c5 กับ `parseBody` ต้องอยู่พร้อมกัน** แล้วใช้ `result.data` (ไม่ใช่ `parsed.data`) ต่อใน `setChatSettings`
- **final gate ไม่ใช่ `npx eslint .` exit 0 ทั้ง repo** — baseline คือ 21 errors / 3 warnings นอกขอบเขตแผนนี้. คาด: ไม่มี error **ใหม่** ในไฟล์ที่แผนแตะ, `tsc` สะอาด, vitest ผ่าน. ห้ามประกาศ lint ทั้ง repo เขียว และห้ามแก้ error นอกแผนเพื่อไล่ exit 0
- integration test เดิมต้องเขียว: `src/app/api/line/admin/conversations/[id]/route.integration.test.ts`, `src/app/api/line/admin/conversations/[id]/prefs/route.integration.test.ts`, `src/app/api/line/admin/search/route.integration.test.ts` (ต้องมี `docker compose up -d postgres redis up-redis` + `npx drizzle-kit push`)
- commit แบบ conventional commits (`refactor(api): …`, `test(api): …`) — push/PR เฉพาะเมื่อผู้ใช้อนุญาต

---

## แผนที่ route → schema → พฤติกรรมเดิม (คงไว้ทุกช่อง)

| # | ไฟล์ (ใน `src/app/api/line/admin/` เว้นแต่ระบุ) | handler | schema | JSON พัง (เดิม) | schema fail (เดิม) | ย้ายใน |
|---|---|---|---|---|---|---|
| 1 | `broadcasts/route.ts` | POST | `createSchema` | 400 `'Invalid JSON'` | 400 `issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง'` | Task 2 |
| 2 | `faq/route.ts` | POST | `faqCreateSchema` | 400 `'Invalid JSON'` | 400 `issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง'` | Task 2 |
| 3 | `faq/[id]/route.ts` | PATCH | `faqUpdateSchema` | 400 `'Invalid JSON'` | 400 `issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง'` | Task 2 |
| 4 | `reply-objects/route.ts` | POST | `createSchema` | 400 `'Invalid JSON'` | 400 `issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง'` | Task 2 |
| 5 | `reply-objects/[id]/route.ts` | PATCH | `updateSchema` | 400 `'Invalid JSON'` | 400 `issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง'` | Task 2 |
| 6 | `rich-menus/route.ts` | POST | `createSchema` | 400 `'Invalid JSON'` | 400 `issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง'` | Task 2 |
| 7 | `settings/route.ts` | PUT | `settingsSchema` | 400 `'Invalid JSON'` | 400 `issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง'` | Task 2 |
| 8 | `canned-responses/route.ts` | POST | `cannedResponseSchema` | 400 `'Invalid JSON'` | 400 `validateOrError` message | Task 3 |
| 9 | `canned-responses/[id]/route.ts` | PATCH | `cannedResponseUpdateSchema` | 400 `'Invalid JSON'` | 400 `validateOrError` message | Task 3 |
| 10 | `conversations/[id]/route.ts` | PATCH | `updateConversationSchema` | 400 `'Invalid JSON'` | 400 `validateOrError` message | Task 3 |
| 11 | `conversations/[id]/messages/route.ts` | POST | `chatReplySchema` | 400 `'Invalid JSON'` | 400 `validateOrError` message | Task 3 |
| 12 | `conversations/[id]/prefs/route.ts` | PUT | `chatPrefsSchema` | 400 `'Invalid JSON'` | 400 `validateOrError` message | Task 3 |
| 13 | `conversations/[id]/tags/route.ts` | PUT | `conversationTagsSchema` | 400 `'Invalid JSON'` | 400 `validateOrError` message | Task 3 |
| 14 | `tags/route.ts` | POST | `chatTagSchema` | 400 `'Invalid JSON'` | 400 `validateOrError` message | Task 3 |
| — | `callback/route.ts` | POST | ไม่มี (`json().catch(() => null)`) | **ตั้งใจ** ignore แล้วไปต่อ | — | Task 4 (อธิบาย ห้ามย้าย) |
| — | `src/app/api/cases/submit/route.ts` | POST | เลือกหลังอ่าน LIFF cookie | 400 `'Invalid JSON'` | — | **ยกเว้น** |
| — | `src/app/api/consent/withdraw/route.ts` | POST | เลือกหลังอ่าน LIFF cookie | 400 `'Invalid JSON'` | — | **ยกเว้น** |
| — | `src/app/api/liff/session/route.ts` | POST | `liffSessionSchema` | — | — | ใช้ `parseBody` อยู่แล้ว (3 caller เดิม) |
| — | `src/app/api/line/admin/intents/route.ts` | POST | `createSchema` | — | — | ใช้ `parseBody` อยู่แล้ว |
| — | `src/app/api/line/admin/intents/[id]/route.ts` | PATCH | `updateSchema` | — | — | ใช้ `parseBody` อยู่แล้ว |

**สรุป:** 15 ไฟล์มี `request.json()` ที่เขียนเอง → ย้าย 14, ยกเว้น 1 (`callback`), ไม่แตะ 2 (submit/withdraw), 3 caller เดิมของ `parseBody` คงเดิม

**จุดที่ต่างเล็กน้อยที่ยอมรับได้ (ประกาศไว้ใน Task 6):** ไม่มี — ทั้ง 14 route มีโค้ด parse+validate ที่ทำงานเหมือน `parseBody` เป๊ะ ข้อความจาก `issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง'` และ `validateOrError`(=`zodErrorToMessage`) จึงเหมือนกันทุกกรณี (รวมกรณี JSON พัง/missing field/type mismatch: `'Too small: …'`, `'Invalid input: …'`, `'ต้องระบุ mode, linkedCaseId, assignedAdminId หรือ adminNote'`, `'ต้องระบุ pinned หรือ muted'` ฯลฯ)

---

## File Structure

| ไฟล์ | การเปลี่ยนแปลง | ความรับผิดชอบ |
|---|---|---|
| `src/lib/api-helpers.test.ts` | Create | unit test ของ `parseBody`/`parseBodyError` (ตอนนี้ไม่มีเลย) |
| `src/app/api/line/admin/broadcasts/route.ts` | Modify `:1-9` (import), `:37-47` | Task 2 |
| `src/app/api/line/admin/faq/route.ts` | Modify import, `:56-65` | Task 2 |
| `src/app/api/line/admin/faq/[id]/route.ts` | Modify import, `:29-39` | Task 2 (ครึ่ง parse เท่านั้น) |
| `src/app/api/line/admin/reply-objects/route.ts` | Modify import, `:38-47` | Task 2 |
| `src/app/api/line/admin/reply-objects/[id]/route.ts` | Modify import, `:29-39` | Task 2 |
| `src/app/api/line/admin/rich-menus/route.ts` | Modify import, `:41-50` | Task 2 |
| `src/app/api/line/admin/settings/route.ts` | Modify import, `:51-60` | Task 2 |
| `src/app/api/line/admin/canned-responses/route.ts` | Modify import, `:36-46` | Task 3 |
| `src/app/api/line/admin/canned-responses/[id]/route.ts` | Modify import, `:19-29` | Task 3 |
| `src/app/api/line/admin/conversations/[id]/route.ts` | Modify import, `:73-83` | Task 3 (PATCH เท่านั้น) |
| `src/app/api/line/admin/conversations/[id]/messages/route.ts` | Modify import, `:51-61` | Task 3 |
| `src/app/api/line/admin/conversations/[id]/prefs/route.ts` | Modify import, `:18-28` | Task 3 |
| `src/app/api/line/admin/conversations/[id]/tags/route.ts` | Modify import, `:20-30` | Task 3 |
| `src/app/api/line/admin/tags/route.ts` | Modify import, `:30-40` | Task 3 |
| `src/app/api/line/callback/route.ts` | Modify `:8-10` (comment เท่านั้น) | Task 4 |

---

### Task 0: เตรียม branch และ baseline

**Files:** ไม่มี

**Interfaces:**
- Consumes: ไม่มี
- Produces: branch `refactor/parsebody-adoption`, stack พร้อม

- [ ] **Step 1: แตก branch**

working tree มีไฟล์ untracked/modified ที่ไม่เกี่ยวข้อง (`.gitignore`, `AGENTS.md`, `next-env.d.ts`, `.claude/…`) — ถ้า checkout ปฏิเสธ ให้ `git stash push -u -m "pre-parsebody"` ก่อน แล้ว `git stash pop` หลังจบงาน (ห้าม commit ไฟล์เหล่านั้นลง branch นี้)

```bash
git checkout main && git pull && git checkout -b refactor/parsebody-adoption
```

Expected: `Switched to a new branch 'refactor/parsebody-adoption'`

- [ ] **Step 2: ตรวจ conflict กับ plan audited-writes**

```bash
git log --oneline -3 -- "src/app/api/line/admin/faq/[id]/route.ts"
```

Expected: ยังไม่มี commit ของ plan `audited-writes` — ถ้ามี ให้ `git fetch origin` อ่านไฟล์ใหม่ทั้งไฟล์ก่อนทำ Task 2 (แผนนั้นแก้ `:47-60`, `:80-89`; แผนนี้แก้ `:29-39` — ห้าม revert ของฝั่งนั้น)

- [ ] **Step 3: baseline — integration test เดิมต้องเขียวก่อน**

```bash
docker compose up -d postgres redis up-redis
npx drizzle-kit push
npx vitest run "src/app/api/line/admin/conversations/[id]/route.integration.test.ts" "src/app/api/line/admin/conversations/[id]/prefs/route.integration.test.ts" src/app/api/line/admin/search/route.integration.test.ts
```

Expected: PASS ทั้งหมด — ถ้าไม่ผ่าน หยุดและแก้ environment ก่อน (Docker / `.env.local` / seed)

---

### Task 1: unit test ของ `parseBody` (เขียน test ก่อน)

**Files:**
- Create: `src/lib/api-helpers.test.ts`

**Interfaces:**
- Consumes: `parseBody<T extends z.ZodType>(schema: T, request: Request): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }>`, `parseBodyError(error: string): NextResponse` จาก `src/lib/api-helpers.ts`
- Produces: test file ที่ล็อกพฤติกรรม 4 ข้อของ `parseBody` ให้ Tasks 2–3 พึ่งพาได้

- [ ] **Step 1: เขียน test**

สร้าง `src/lib/api-helpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseBody, parseBodyError } from './api-helpers';

/**
 * parseBody = ทางเข้าเดียวของ route handler ที่รับ JSON
 * ก่อนหน้านี้ไม่มี test เลย ทั้งที่ 14 route จะย้ายมาใช้ — ล็อก 4 พฤติกรรมนี้ก่อน
 */
const schema = z.object({ name: z.string().min(1, 'ต้องระบุชื่อ'), count: z.number().int().optional() });

function requestWith(body: string): Request {
  return new Request('http://localhost:3000/api/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

describe('parseBody', () => {
  it('JSON ผ่าน schema → ok: true พร้อม data ที่ผ่าน transform/default', async () => {
    const result = await parseBody(schema, requestWith(JSON.stringify({ name: 'ทดสอบ' })));

    expect(result).toEqual({ ok: true, data: { name: 'ทดสอบ' } });
  });

  it('JSON พัง → ok: false, 400, { error: "Invalid JSON" } — ตรงกับโค้ดที่เขียนเอง', async () => {
    const result = await parseBody(schema, requestWith('{ not json'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
    expect(await result.response.json()).toEqual({ error: 'Invalid JSON' });
  });

  it('schema ไม่ผ่าน → ok: false, 400, ข้อความ zod ตัวแรก (ภาษาไทย/ของ schema)', async () => {
    const result = await parseBody(schema, requestWith(JSON.stringify({ name: '' })));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
    expect(await result.response.json()).toEqual({ error: 'ต้องระบุชื่อ' });
  });

  it('ข้อความ default ของ zod (ไม่ได้ตั้งเอง) ถูกส่งออกตรง ๆ', async () => {
    const result = await parseBody(schema, requestWith(JSON.stringify({})));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // zod 4.4.3 — message เดียวกับที่โค้ดเดิม `issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง'` คืน
    expect(await result.response.json()).toEqual({
      error: 'Invalid input: expected string, received undefined',
    });
  });

  it('type mismatch → 400 พร้อม message ของ zod', async () => {
    const result = await parseBody(schema, requestWith(JSON.stringify({ name: 'x', count: 1.5 })));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(await result.response.json()).toEqual({
      error: 'Invalid input: expected integer, received float',
    });
  });
});

describe('parseBodyError', () => {
  it('คืน 400 JSON envelope เดียว', async () => {
    const response = parseBodyError('ข้อมูลไม่ถูกต้อง');

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'ข้อมูลไม่ถูกต้อง' });
  });
});
```

- [ ] **Step 2: รัน test**

Run: `npx vitest run src/lib/api-helpers.test.ts`
Expected: PASS 6 tests (test เขียนทับฟังก์ชันที่มีอยู่แล้ว — RED จึงเป็น "test หายไป" ไม่ใช่ "พัง"; ถ้ามี assertion ใด fail แปลว่าความเข้าใจพฤติกรรมผิด ให้หยุดดู `src/lib/api-helpers.ts` ก่อนไปต่อ)

- [ ] **Step 1b: characterization — schema จริง 3 ตัวแทน (ไม่ครบ 14)**

เพิ่มใน `src/lib/api-helpers.test.ts` (import schema จาก `@/lib/validation` ไม่สร้าง schema ใหม่):

```ts
import { chatPrefsSchema, chatTagSchema } from '@/lib/validation';

describe('parseBody กับ schema จริง (ตัวแทน ไม่ครบ 14 route)', () => {
  it.each([
    {
      name: 'refine: prefs ว่าง → ข้อความ refine',
      schema: chatPrefsSchema,
      body: {},
      error: 'ต้องระบุ pinned หรือ muted',
    },
    {
      name: 'optional+default: tags ไม่ส่ง color → ไม่ 400 (default accent)',
      schema: chatTagSchema,
      body: { name: 'ด่วน' },
      error: null,
    },
    {
      name: 'refine ผ่าน: prefs ส่ง pinned',
      schema: chatPrefsSchema,
      body: { pinned: true },
      error: null,
    },
  ])('$name', async ({ schema, body, error }) => {
    const result = await parseBody(schema, requestWith(JSON.stringify(body)));
    if (error === null) {
      expect(result.ok).toBe(true);
      return;
    }
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
    expect(await result.response.json()).toEqual({ error });
  });
});
```

**authorize ก่อน parse** — เลือก `POST /api/line/admin/canned-responses` (handler เรียก `requireStaffApi` ก่อน `request.json()` บรรทัด 32-38). ย้ายเป็น `parseBody` แล้วลำดับต้องคง: ไม่มี session → 401 และ **ไม่** อ่าน body

เพิ่มเคสใน `src/app/api/line/admin/canned-responses/route.integration.test.ts` ถ้ามีไฟล์นั้นอยู่แล้ว ไม่งั้นสร้างไฟล์ใหม่ที่ใช้ harness เดียวกับ `conversations/[id]/route.integration.test.ts` (cookie/session helper เดิม ห้ามเขียน auth ใหม่):

```ts
it('ไม่มี session → 401 ก่อน parse (body พังก็ยัง 401 ไม่ใช่ 400)', async () => {
  const res = await POST(
    new Request('http://localhost/api/line/admin/canned-responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    }),
  );
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ error: 'Unauthorized' });
});
```

ถ้าย้าย `parseBody` ไปก่อน `requireStaffApi` test นี้ได้ 400 — ถือว่าพัง แก้ลำดับไม่แก้ test

Run: `npx vitest run src/lib/api-helpers.test.ts`

Expected: PASS รวมตาราง 3 แถว. integration รันใน Task 5 (ต้องมี docker)

> **TDD note:** `parseBody` เขียนมานานแล้วโดยไม่มี test — หน้าที่ของ task นี้คือ *ล็อก* พฤติกรรมปัจจุบัน (characterization test) ก่อนที่ 14 route จะย้ายมาพึ่งมัน Tasks 2–3 ไม่มี test ใหม่ต่อ route ครบ 14 (พฤติกรรมถูกล็อกที่ module + integration เดิมของ conversations/*) แต่ Task 1 Step 1b ล็อก schema จริง 3 ตัวแทน (refine / optional+default / authorize ก่อน parse)

- [ ] **Step 3: Commit**

```bash
git add src/lib/api-helpers.test.ts
git commit -m "test(api): unit test parseBody (json พัง / schema fail / message zod ตัวแรก)"
```

---

### Task 2: ย้าย batch A — 7 route แบบ inline `safeParse` + `issues[0]?.message`

**Files:**
- Modify (ทุกไฟล์: เพิ่ม import + แทนช่วง parse):
  - `src/app/api/line/admin/broadcasts/route.ts:1-9`, `:37-47`
  - `src/app/api/line/admin/faq/route.ts`, `:56-65`
  - `src/app/api/line/admin/faq/[id]/route.ts`, `:29-39`
  - `src/app/api/line/admin/reply-objects/route.ts`, `:38-47`
  - `src/app/api/line/admin/reply-objects/[id]/route.ts`, `:29-39`
  - `src/app/api/line/admin/rich-menus/route.ts`, `:41-50`
  - `src/app/api/line/admin/settings/route.ts`, `:51-60`

**Interfaces:**
- Consumes: `parseBody(schema, request)` จาก Task 1 (พฤติกรรมถูกล็อกแล้ว)
- Produces: ทั้ง 7 route คืน `result.response` บนความล้มเหลว, ใช้ `result.data` ต่อ — ตัวแปรชื่อ `result` ทุกไฟล์ (โค้ดหลัง parse เดิมใช้ `parsed.data` → เปลี่ยนเป็น `result.data`)

- [ ] **Step 1: broadcast — import**

`src/app/api/line/admin/broadcasts/route.ts:1-9` เพิ่ม `import { parseBody } from '@/lib/api-helpers';` หลัง line 6 (`import { generateId } from '@/lib/id';`)

- [ ] **Step 2: broadcast — แทนช่วง parse**

แทน `:37-47`:
```ts
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }
```
ด้วย:
```ts
  const result = await parseBody(createSchema, request);
  if (!result.ok) return result.response;
```

แล้วแทนทุก `parsed.data` ใน handler POST (`:51-60`: `parsed.data.content`, `parsed.data.scheduledAt` ×2, `parsed.data.target`) เป็น `result.data.*`

> `NextResponse` ยังถูกใช้ที่ GET (`:30`) — คง import `:1` ไว้; ถ้าไฟล์ไหนไม่ใช้ `NextResponse` อีกเลยหลังย้าย ให้ลบ import ตามที่ eslint เตือน

- [ ] **Step 3: faq/route.ts (POST)**

Import เพิ่มเหมือน Step 1 ที่ `:9` 附近 (หลัง `import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';`)

แทน `:56-65` (ลองเทียบไฟล์จริง — คือบล็อก `let body…try…catch` ต่อด้วย `const parsed = faqCreateSchema.safeParse(body); if (!parsed.success) {...}`):
```ts
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = faqCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }
```
ด้วย:
```ts
  const result = await parseBody(faqCreateSchema, request);
  if (!result.ok) return result.response;
```

แทนทุก `parsed.data` ใน POST เป็น `result.data` (`question`, `answer`, `keywords`, `priority`, `isActive` — รวมจุด `Object.keys(parsed.data)` ถ้ามี)

- [ ] **Step 4: faq/[id]/route.ts (PATCH)**

Import เพิ่ม; แทน `:29-39`:
```ts
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = faqUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }
```
ด้วย:
```ts
  const result = await parseBody(faqUpdateSchema, request);
  if (!result.ok) return result.response;
```

แล้วแทน `parsed.data` ที่เหลือเป็น `result.data`:
- `:47-50` → `.set({ ...result.data, updatedAt: new Date() })`
- `:59` → `metadata: { changes: Object.keys(result.data) }`

> **ระวัง conflict กับ plan `audited-writes`:** ถ้าไฟล์จริงมี `db.transaction(async (tx) => {…})` ครอบส่วน update+audit (ของ plan นั้น) ให้แก้เฉพาะบรรทัด `parsed.data` ภายในนั้นเป็น `result.data` ห้ามแตะ tx

- [ ] **Step 5: reply-objects/route.ts (POST)**

Import เพิ่ม; แทน `:38-47`:
```ts
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }
```
ด้วย:
```ts
  const result = await parseBody(createSchema, request);
  if (!result.ok) return result.response;
```
แทน `parsed.data.objectId/objectType/payload/altText/isActive` เป็น `result.data.*`

- [ ] **Step 6: reply-objects/[id]/route.ts (PATCH)**

Import เพิ่ม; แทน `:29-39` (`let body…` + `const parsed = updateSchema.safeParse(body);…`):
```ts
  const result = await parseBody(updateSchema, request);
  if (!result.ok) return result.response;
```
แทน `:49` `.set({ ...parsed.data, updatedAt: new Date() })` เป็น `.set({ ...result.data, updatedAt: new Date() })`

- [ ] **Step 7: rich-menus/route.ts (POST)**

Import เพิ่ม; แทน `:41-50` ด้วย pattern เดียวกับ Step 2:
```ts
  const result = await parseBody(createSchema, request);
  if (!result.ok) return result.response;
```
แทน `parsed.data.name/chatBarText/config` เป็น `result.data.*`

- [ ] **Step 8: settings/route.ts (PUT)**

Import เพิ่ม; แทน `:51-60` ด้วย:
```ts
  const result = await parseBody(settingsSchema, request);
  if (!result.ok) return result.response;
```
แทนลูป `:63-69` (`Object.entries(parsed.data)` → `Object.entries(result.data)`)

- [ ] **Step 9: รัน test + gate**

Run: `npx tsc --noEmit`
Expected: ไม่มี error (จุดที่ยังอ้าง `parsed.` จะโดนจับที่นี่)

Run: `npx eslint src/app/api/line/admin`
Expected: ไม่มี error (eslint จะจับ `NextResponse` import ที่ไม่ใช้/unused `validateOrError` import ให้ลบ)

Run: `npx vitest run src/lib/api-helpers.test.ts`
Expected: PASS 6 tests

- [ ] **Step 10: Commit**

```bash
git add src/app/api/line/admin/broadcasts/route.ts src/app/api/line/admin/faq/route.ts "src/app/api/line/admin/faq/[id]/route.ts" src/app/api/line/admin/reply-objects/route.ts "src/app/api/line/admin/reply-objects/[id]/route.ts" src/app/api/line/admin/rich-menus/route.ts src/app/api/line/admin/settings/route.ts
git commit -m "refactor(api): 7 route admin ใช้ parseBody แทน inline safeParse"
```

---

### Task 3: ย้าย batch B — 7 route แบบ `validateOrError`

**Files:**
- Modify:
  - `src/app/api/line/admin/canned-responses/route.ts`, `:36-46`
  - `src/app/api/line/admin/canned-responses/[id]/route.ts`, `:19-29`
  - `src/app/api/line/admin/conversations/[id]/route.ts`, `:73-83` (PATCH เท่านั้น — GET ใช้ `validateOrError` กับ query string ไม่เกี่ยว ห้ามแตะ)
  - `src/app/api/line/admin/conversations/[id]/messages/route.ts`, `:51-61`
  - `src/app/api/line/admin/conversations/[id]/prefs/route.ts`, `:18-28`
  - `src/app/api/line/admin/conversations/[id]/tags/route.ts`, `:20-30`
  - `src/app/api/line/admin/tags/route.ts`, `:30-40`

**Interfaces:**
- Consumes: `parseBody` (Task 1); `validateOrError` ยังถูกใช้ที่ GET query / route ที่ไม่ย้าย (คง import ถ้ายังใช้)
- Produces: ทั้ง 7 route คืน `result.response` / ใช้ `result.data` (แทน `validation.data`); ข้อความ error เดิมทุกตัว (พิสูจน์โดย Global Constraint: `zodErrorToMessage` ≡ `parseBody`)

- [ ] **Step 1: canned-responses/route.ts (POST)**

เพิ่ม `import { parseBody } from '@/lib/api-helpers';`

แทน `:36-46`:
```ts
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validation = validateOrError(cannedResponseSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
```
ด้วย:
```ts
  const result = await parseBody(cannedResponseSchema, request);
  if (!result.ok) return result.response;
```
แทน `validation.data.title/shortcut/content` → `result.data.*` (`:54-56`); ถ้า import ของ `validateOrError` ไม่ถูกใช้แล้ว (ไฟล์นี้ GET ไม่ได้ validate) ให้ลบออกจาก import ที่ `:8` (คง `cannedResponseSchema`)

- [ ] **Step 2: canned-responses/[id]/route.ts (PATCH)**

เพิ่ม import; แทน `:19-29` ด้วย pattern เดียวกัน:
```ts
  const result = await parseBody(cannedResponseUpdateSchema, request);
  if (!result.ok) return result.response;
```
แทน `validation.data` → `result.data` (`:37` `.set({ ...result.data, updatedAt: new Date() })`); คง `validateOrError` ใน import ไว้ถ้าไม่ถูกใช้แล้วให้ลบ

- [ ] **Step 3: conversations/[id]/route.ts (PATCH เท่านั้น)**

เพิ่ม `import { parseBody } from '@/lib/api-helpers';`

แทน `:73-83`:
```ts
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validation = validateOrError(updateConversationSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
```
ด้วย:
```ts
  const result = await parseBody(updateConversationSchema, request);
  if (!result.ok) return result.response;
```
แทน `validation.data` → `result.data` ทุกจุดใน PATCH (`:85` `const { mode, linkedCaseId, assignedAdminId, transferReason, adminNote } = result.data;`)

> **คงไว้:** GET (`:16-64`) ยังใช้ `validateOrError(chatPagingQuerySchema, …)` กับ query string — `parseBody` รับ `Request` เฉพาะ JSON body จึงไม่แทนกัน; คง import `validateOrError` ไว้; คง `§` comment ทั้งหมดใน handler

- [ ] **Step 4: conversations/[id]/messages/route.ts (POST)**

เพิ่ม import; แทน `:51-61` ด้วย:
```ts
  const result = await parseBody(chatReplySchema, request);
  if (!result.ok) return result.response;
```
แทน `validation.data` → `result.data` (`:63` `const { text, clientTempId } = result.data;`); ลบ `validateOrError` จาก import ถ้าไม่ใช้แล้ว

- [ ] **Step 5: conversations/[id]/prefs/route.ts (PUT)**

เพิ่ม import; แทน `:18-28` ด้วย:
```ts
  const result = await parseBody(chatPrefsSchema, request);
  if (!result.ok) return result.response;
```
แทน `:30` `const { pinned, muted } = result.data;`; ลบ `validateOrError` จาก import `:7` ถ้าไม่ใช้แล้ว

> **สำคัญ:** ไฟล์นี้มี integration test (`prefs/route.integration.test.ts`) — ยิง request ทั้ง valid/invalid อยู่แล้ว ต้องเขียวหลังย้าย

- [ ] **Step 6: conversations/[id]/tags/route.ts (PUT)**

เพิ่ม import; แทน `:20-30` ด้วย:
```ts
  const result = await parseBody(conversationTagsSchema, request);
  if (!result.ok) return result.response;
```
แทน `:32` `const { tagIds } = result.data;`; ลบ `validateOrError` ถ้าไม่ใช้แล้ว

- [ ] **Step 7: tags/route.ts (POST)**

เพิ่ม import; แทน `:30-40` ด้วย:
```ts
  const result = await parseBody(chatTagSchema, request);
  if (!result.ok) return result.response;
```
แทน `:46` `.insert(chatTags).values({ id, ...result.data })` และ `:55` `{ ok: true, id, name: result.data.name, color: result.data.color }`; ลบ `validateOrError` ถ้าไม่ใช้แล้ว

- [ ] **Step 8: รัน integration test ของ conversations ทั้งหมด**

```bash
npx tsc --noEmit
npx eslint src/app/api/line/admin
npx vitest run "src/app/api/line/admin/conversations/[id]/route.integration.test.ts" "src/app/api/line/admin/conversations/[id]/prefs/route.integration.test.ts" src/app/api/line/admin/search/route.integration.test.ts src/lib/api-helpers.test.ts
```

Expected: tsc/eslint ไม่มี error; ทุก test PASS — **ห้ามแก้ assertion ของ test เดิม**

- [ ] **Step 9: Commit**

```bash
git add src/app/api/line/admin/canned-responses/route.ts "src/app/api/line/admin/canned-responses/[id]/route.ts" "src/app/api/line/admin/conversations/[id]/route.ts" "src/app/api/line/admin/conversations/[id]/messages/route.ts" "src/app/api/line/admin/conversations/[id]/prefs/route.ts" "src/app/api/line/admin/conversations/[id]/tags/route.ts" src/app/api/line/admin/tags/route.ts
git commit -m "refactor(api): อีก 7 route (validateOrError) ใช้ parseBody — ข้อความ error เดิมทุกตัว"
```

---

### Task 4: `callback` route — อธิบายว่าทำไมตั้งใจไม่ย้าย

**Files:**
- Modify: `src/app/api/line/callback/route.ts:8-10` (comment เท่านั้น)

**Interfaces:**
- Consumes: ไม่มี
- Produces: § comment ที่ระบุ invariant ให้คนรุ่นหลังไม่ย้าย route นี้

- [ ] **Step 1: อ่านพฤติกรรมปัจจุบัน**

```powershell
Get-Content src/app/api/line/callback/route.ts
```

เทียบเท่า bash: `cat src/app/api/line/callback/route.ts`

Expected: `await request.json().catch(() => null);` แล้ว `return NextResponse.json({ ok: true });` — JSON พัง = ทิ้ง body แล้ว **ACK `{ ok: true }`** (ไม่ตอบ 400). comment เดิม (`:5-7`) บอกชัดว่า endpoint นี้ **ไม่ verify signature โดยเจตนา** — งาน signature อยู่ที่ `/api/line/webhook` ห้ามปะปน

- [ ] **Step 2: เพิ่ม § comment**

แทน `:8-10`:
```ts
  // body ที่ parse ไม่ได้ต้องไม่กลายเป็น 500 — ใครก็ยิง endpoint นี้ได้
  await request.json().catch(() => null);
```
ด้วย:
```ts
  // § ตั้งใจไม่ใช้ parseBody — handler นี้ทิ้ง body แล้วคืน { ok: true } เสมอ (ACK)
  // parseBody ตอบ 400 เมื่อ JSON พัง = เปลี่ยนพฤติกรรม ห้ามทำโดยไม่ทบทวน (ดูการ์ด c8)
  // ไม่มีการตัดสิน signature ใน handler นี้ — อย่าปะปนกับ /api/line/webhook
  await request.json().catch(() => null);
```

- [ ] **Step 3: รัน gate ของไฟล์**

Run: `npx tsc --noEmit && npx eslint src/app/api/line/callback/route.ts`
Expected: ไม่มี error

- [ ] **Step 4: Commit**

```bash
git add src/app/api/line/callback/route.ts
git commit -m "docs(line): § callback route ตั้งใจ ACK {ok:true} ไม่ใช้ parseBody"
```

---

### Task 5: Gate รวม + ตรวจความครบ

**Files:** ไม่มี (ตรวจอย่างเดียว)

**Interfaces:**
- Consumes: ผลของ Task 1–4
- Produces: branch พร้อม PR

- [ ] **Step 1: gate ทั้งหมด**

```bash
npx tsc --noEmit
npx eslint .
npx vitest run
```

Expected: `tsc` ไม่มี output; vitest PASS ทุกไฟล์ รวม integration test + `tokens.contrast.test.ts`

**eslint ทั้ง repo ไม่ใช่ exit 0** — baseline 21 errors / 3 warnings อยู่นอกแผน. ผ่านเมื่อไม่มี error **ใหม่** ในไฟล์ที่แผนแตะ (เทียบ `npx eslint .` ก่อน Task 2) ห้ามประกาศ lint ทั้ง repo เขียว

- [ ] **Step 2: นับ `.json(` แบบ exhaustive แล้วตรวจ allowlist**

ห้าม `grep "try {" | grep "await request.json()"` — สองคำสั่งคนละบรรทัด ผลเป็น 0 เสมอ (false green)

PowerShell (shell ของเครื่องนี้):

```powershell
Get-ChildItem -Path src/app/api -Filter route.ts -Recurse |
  Select-String -Pattern 'request\.json\(|req\.json\(' |
  ForEach-Object { "$($_.Path.Replace((Get-Location).Path + '\\', '')):$($_.LineNumber):$($_.Line.Trim())" }
```

เทียบเท่า bash:

```bash
grep -rn -E 'request\.json\(|req\.json\(' src/app/api --include=route.ts
```

Expected: เหลือเฉพาะ 3 ไฟล์นี้ ไม่มีไฟล์ที่ 4

- `src/app/api/line/callback/route.ts` — ACK `{ ok: true }` (Task 4)
- `src/app/api/cases/submit/route.ts` — `req.json()` นอก scope
- `src/app/api/consent/withdraw/route.ts` — `req.json()` นอก scope

นับ `parseBody(` (ไม่นับ test):

```powershell
(Get-ChildItem -Path src/app/api -Filter *.ts -Recurse |
  Where-Object { $_.Name -notmatch 'test' } |
  Select-String -Pattern 'parseBody\(').Count
```

เทียบเท่า bash: `grep -rn "parseBody(" src/app/api --include=*.ts | grep -v test | wc -l`

Expected: 17 (3 caller เดิม + 14 ที่ย้าย)

- [ ] **Step 3: ตรวจ diff ว่าไม่มีไฟล์นอกแผน**

```bash
git diff --stat main...HEAD
```

Expected: เฉพาะ 16 ไฟล์ในตาราง File Structure — ไม่มี `submit/route.ts`, `withdraw/route.ts`, `api-helpers.ts`, `validation.ts`, `.gitignore`, `.claude/*`

- [ ] **Step 4: (เมื่อผู้ใช้อนุญาต) push + PR**

```bash
git push -u origin refactor/parsebody-adoption
gh pr create --title "refactor: parseBody เป็นทางเข้าเดียวของ route handler (14 routes)" --body "ตามการ์ด c8 — JSON parse + zod validate ในที่เดียว ข้อความ error/status เดิมทุกตัว (พิสูจน์โดย api-helpers.test.ts + zodErrorToMessage ≡ issues[0]?.message) ยกเว้น callback ตั้งใจไม่ย้าย, submit/withdraw ยกเว้นตาม scope"
```

---

## Self-Review

1. **Spec coverage (การ์ด c8):** "16 route.ts เช่น faq, faq/[id], reply-objects, rich-menus, broadcasts, settings" → Task 2 ครบทั้ง 7 ไฟล์ที่ยกมา; ไฟล์ที่เหลือใน 16 ที่มี `request.json()` → Task 3 (7) + Task 4 (callback, ยกเว้นพร้อมเหตุผล) + ข้อยกเว้น submit/withdraw ระบุใน Global Constraints; "มีผู้เรียกแค่ 3" → เพิ่มเป็น 17 หลังย้าย; "ข้อความ error รูปแบบเดียว" → Task 1 l็อก `parseBody` ก่อน + พิสูจน์ `zodErrorToMessage ≡ issues[0]?.message` ใน Global Constraints; ไม่สร้าง module ใหม่ ✓
2. **Placeholder scan:** ไม่มี TBD/TODO; ทุก step มีโค้ดก่อน/หลังเต็ม (pattern ซ้ำใน batch ถูกรายงานเป็นบล็อกโค้ดเต็มใน Step แรกของแต่ละ task แล้วอ้าง pattern ใน Step ถัดไปพร้อมชื่อตัวแปรและ line number จริง — เป็นการอ้างงานที่เพิ่งทำใน task เดียวกัน ไม่ใช่ "ไปดู Task N")
3. **Type consistency:** ตัวแปรผลลัพธ์ชื่อ `result` ทั้ง 14 route (`result.ok` / `result.response` / `result.data`) ตรงกับ type ที่ `parseBody` คืน; ไม่มีที่ไหนใช้ `validation.data` หลังย้ายยกเว้น GET query ของ `conversations/[id]` ที่ระบุไว้ชัด

**พฤติกรรมที่เปลี่ยน:** ไม่มี — ตารางพฤติกรรมด้านบนล็อกไว้ทุกช่อง จุดเดียวที่ "ไม่ย้าย" คือ `callback` (Task 4: ทิ้ง body แล้ว ACK `{ ok: true }` ไม่มี signature decision ใน handler นี้) และ 2 route ยกเว้นตาม scope

**Gate:** Task 5 ไม่คาด `eslint .` exit 0 — baseline 21 errors / 3 warnings นอกแผน. ผ่านเมื่อไม่เพิ่ม error ในไฟล์ที่แตะ
