# Conversation Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** รวมการเปลี่ยนโหมดบทสนทนา LINE (`bot_active → waiting_handoff → human_active → resolved`) และการบันทึกข้อความ + broadcast ไว้ใน module เดียว `src/lib/line/conversation/` พร้อมแก้บั๊ก handoff ที่ไม่ broadcast `mode_change` ข้อยกเว้นที่คงพฤติกรรมเดิม: คำตอบของบอท (`recordBotReplies`) บันทึกแถวข้อความอย่างเดียว — ไม่อัปเดต `lastMessage*` และไม่ broadcast (ดู Task 5)

**Architecture:** ตารางเปลี่ยนโหมดแบบ pure (`modes.ts`) เป็นผู้ตัดสินเดียวว่าเปลี่ยนจากโหมดไหนไปโหมดไหนได้ — `mode-service.ts` แปลงตารางเป็น atomic guarded `UPDATE … WHERE mode IN (…)` แล้ว broadcast ทุกครั้งที่เปลี่ยนจริง; `message-service.ts` เป็นเจ้าของ "insert ข้อความ + อัปเดตข้อความล่าสุด + broadcast" ของขาเข้า (ผู้ใช้) และขาออก (แอดมินตอบ + push แบบ idempotent) — คำตอบบอทเป็นข้อยกเว้น: insert อย่างเดียว ไม่แตะข้อความล่าสุด ไม่ broadcast การคุยกับ LINE ผ่าน port `LineTransport` ที่มีสอง adapter จริง: `httpLineTransport` (ห่อ `client.ts` เดิม, ใช้ใน prod) และ `createRecordingTransport()` (in-memory, ใช้ในเทสต์) จากนั้นย้าย engine, handoff, PATCH route, messages route มาเรียก module ทีละ task

**Tech Stack:** Next.js 16 route handlers, Drizzle ORM + postgres-js, Vitest 3 (unit + `*.integration.test.ts` บน Postgres จริง), SSE broadcaster (EventEmitter + Upstash Redis bridge)

**Spec:** `project-log-md/architecture-review/2026-10-03/architecture-review-20261003-205746.html` การ์ด `id="c4"` ("4 · Conversation module: โหมดสนทนาและการบันทึกข้อความ") + `AGENTS.md` หัวข้อ "LINE subsystem"

## Global Constraints

- ห้ามใช้ `pnpm` (hang ในเครื่องนี้) — ใช้ `npx` ทุกคำสั่ง: `npx vitest run …`, `npx tsc --noEmit`, `npx eslint <ไฟล์ที่แตะ>` (ไม่ใช่ `npx eslint .` ทั้ง repo — ดู gate ด้านล่าง)
- คอมเมนต์และข้อความที่ผู้ใช้เห็นเป็นภาษาไทย; คอมเมนต์ที่อธิบายการตัดสินใจที่ไม่ชัด/บั๊กที่แก้ ขึ้นต้นด้วย `§`; **ห้ามลบ `§` comment เดิม** — ถ้าย้ายโค้ดให้ย้าย comment ไปด้วย
- `await getDb()` ภายในฟังก์ชันเท่านั้น ห้ามเรียกระดับ module
- ใช้ `firstOrUndefined()` จาก `src/lib/db/query-helpers.ts` แทน `.limit(1)` + `[0]` ในโค้ดใหม่
- ID มาจาก `generateId()` (`src/lib/id.ts`) เสมอ
- Authorization อยู่ที่ route (`requireStaffApi(STAFF_ROLES)`) — module ไม่ตรวจสิทธิ์ และไม่มี RLS ใน DB ให้พึ่ง
- SSE contract ห้ามเปลี่ยน: `SseEvent['type']` คงเป็น `'new_message' | 'conversation_update' | 'mode_change'`; payload ของ `mode_change` ต้องเป็น `{ mode?: ConversationMode; assignedAdminId?: string; linkedCaseId?: string | null }` ให้ตรงกับ `SseChatEvent` ใน `src/app/admin/chat/_lib/types.ts` ที่ client อ่าน `payload.mode` / `payload.assignedAdminId`
- HTTP response ของ route ทั้งสอง (status code, shape JSON, ข้อความ error ภาษาไทย) ต้องเหมือนเดิมทุกกรณี ยกเว้นที่ระบุใน Task 9 ว่าตั้งใจเปลี่ยน
- Integration test ต้องมี stack local: `docker compose up -d postgres redis up-redis` (Postgres `:5433`, up-redis host port `8081` ตาม `UPREDIS_HOST_PORT` ใน `.env` และ `UPSTASH_REDIS_REST_URL=http://localhost:8081` ใน `.env.local`)
- ไม่มี `console.log` ในโค้ด production (`console.error`/`console.warn` เดิมคงไว้ได้)
- ฟังก์ชัน < 50 บรรทัด, ไฟล์ < 800 บรรทัด
- GitHub Actions ถูกพักไว้ — gate จริงคือ `npx tsc --noEmit` + `npx eslint` เฉพาะไฟล์ที่แผนนี้แตะ (ต้อง 0 error) + `npx vitest run` บนเครื่อง + Vercel preview ห้ามอ้าง `npx eslint .` exit 0: baseline ของ repo มี 21 errors / 3 warnings ที่ไม่เกี่ยวกับแผนนี้ ไม่ต้องแก้ในงานนี้ และห้ามเปลี่ยน gate เป็น ignore failures
- Commit แบบ conventional commits, `git add` เฉพาะไฟล์ที่ระบุ (ไม่ใช้ `git add -A` — working tree มีไฟล์ untracked ที่ไม่เกี่ยว)
- ไม่แตะ: `src/app/api/line/webhook/route.ts`, SSE stream route, `src/app/admin/chat/**`, `read/route.ts`, `tags/route.ts` ใน engine: **รักษาพฤติกรรม follow เดิม** (Task 8 inject `LineTransport` เข้า `handleFollowEvent` ได้ แต่ผลที่ผู้ใช้เห็นต้องเหมือนเดิม) และ **ห้ามเปลี่ยน `handlePostbackEvent`**
- Idempotency ของ `sendAdminReply` มี scope เท่า route เดิม ไม่ใช่ regression: กัน insert ซ้ำด้วย unique `clientTempId` (DB insert dedup) และ retry แบบลำดับ (sequential retry ของแถวที่ `pushStatus=failed`) เท่านั้น ไม่รับประกัน concurrent failed-retry — สอง request ที่เห็น `failed` พร้อมกันยัง push LINE ซ้ำได้ ไม่มี atomic claim `failed → pending`
- **ชนกับ plan `citizen-case-access`:** แผนนั้นแก้ `engine.ts` ที่ Task 7 (`trackCase` เรียก `findTrackableCase`) และ `engine.test.ts` ด้วย — ก่อนเริ่ม Task 8 ให้ `git fetch origin && git log origin/main --oneline -- src/lib/line/bot/engine.ts` ถ้ามี commit จากแผนนั้นใน main แล้ว ให้ rebase แล้วอ่านไฟล์ใหม่ทั้งไฟล์ ปรับ step ให้ตรงโค้ดจริงโดยคงทั้งสองการเปลี่ยนแปลงไว้; ถ้าทำคู่ขนาน คน merge ทีหลังเป็นฝ่าย rebase
- **ชนกับ plan `parsebody-adoption` (c8):** Task 9–10 เขียน PATCH `/conversations/[id]` และ POST `…/messages` ใหม่ทั้งก้อน ต้องใช้ `parseBody` จาก `src/lib/api-helpers.ts` ไม่ใช่ `request.json()` + `validateOrError` ถ้า c8 merge ก่อน ห้าม revert กลับไป manual parse แม้ compile/test ของแผนนี้จะผ่าน
- **ลำดับกับ plan `bot-config-module` (c5) — c5 ทำหลัง c4 เสมอ:** ทั้งคู่แก้ `engine.ts` / `engine.test.ts` คนละความหมาย (c4 inject transport + `recordInboundMessage`/`recordBotReplies`; c5 เพิ่ม `now` ให้ `routeBotMessage` และเช็ก `bot_enabled`) c5 ต้อง rebase แล้วเขียน step ใหม่จากไฟล์จริง ห้าม apply snippet ของ c5 ทับฟังก์ชันที่ c4 เขียนใหม่ และ bot-disabled ต้องเรียก `changeMode` ของ c4 ไม่ใช่ `UPDATE` mode ตรง (รายละเอียดอยู่ในแผน c5)

---

## File Structure

| ไฟล์ | สถานะ | หน้าที่ |
|---|---|---|
| `src/lib/line/conversation/modes.ts` | Create | ตารางเปลี่ยนโหมด pure + `canTransition`, `allowedSourceModes`, `isHumanHandled` |
| `src/lib/line/conversation/modes.test.ts` | Create | unit test ตาราง |
| `src/lib/line/conversation/transport.ts` | Create | port `LineTransport` + adapter `httpLineTransport` (ห่อ `client.ts`) |
| `src/lib/line/conversation/recording-transport.ts` | Create | adapter in-memory `createRecordingTransport()` สำหรับเทสต์ |
| `src/lib/line/conversation/transport.test.ts` | Create | contract test ของทั้งสอง adapter |
| `src/lib/line/conversation/mode-service.ts` | Create | `changeMode`, `transferOwnership`, `linkCase` — guarded UPDATE + broadcast |
| `src/lib/line/conversation/mode-service.integration.test.ts` | Create | integration test บน Postgres จริง |
| `src/lib/line/conversation/message-service.ts` | Create | `recordInboundMessage`, `recordBotReplies`, `sendAdminReply` |
| `src/lib/line/conversation/message-service.integration.test.ts` | Create | integration test บน Postgres จริง + recording transport |
| `src/lib/line/conversation/index.ts` | Create | public API ของ module (barrel) |
| `src/lib/line/bot/handoff.ts` | Modify | Task 1 แก้บั๊ก, Task 7 ย้ายไปใช้ `changeMode` |
| `src/lib/line/bot/handoff.test.ts` | Modify | regression test ของ `triggerHandoff` |
| `src/lib/line/bot/engine.ts` | Modify | ใช้ `recordInboundMessage`/`recordBotReplies` + inject `LineTransport` |
| `src/lib/line/bot/engine.test.ts` | Modify | ตัด mock `../client`, เพิ่มเทสต์ `handleEvent` ผ่าน recording transport |
| `src/app/api/line/admin/conversations/[id]/route.ts` | Modify | PATCH ใช้ `changeMode`/`transferOwnership`/`linkCase` |
| `src/app/api/line/admin/conversations/[id]/route.integration.test.ts` | Modify | เพิ่มเทสต์ transition ผ่าน module |
| `src/app/api/line/admin/conversations/[id]/messages/route.ts` | Modify | POST ใช้ `sendAdminReply` |
| `src/app/api/line/admin/conversations/[id]/messages/route.integration.test.ts` | Create | characterization test (stub `fetch`) ก่อน migrate |

---

### Task 0: สร้าง branch

**Files:** ไม่มี

- [ ] **Step 1: แตก branch จาก main ล่าสุด**

```bash
git checkout main && git pull && git checkout -b refactor/conversation-module
```

Expected: `Switched to a new branch 'refactor/conversation-module'`

> หมายเหตุ: working tree ตอนเขียนแผนมีไฟล์ modified (`.gitignore`, `AGENTS.md`, `next-env.d.ts`) และ untracked หลายไฟล์ — ถ้า `git checkout main` ปฏิเสธเพราะ local changes ให้หยุดถามผู้ใช้ ห้าม stash/discard เอง

- [ ] **Step 2: ยืนยันว่า stack local พร้อมสำหรับ integration test**

```bash
docker compose up -d postgres redis up-redis
npx vitest run "src/app/api/line/admin/conversations/[id]/route.integration.test.ts"
```

Expected: `Test Files  1 passed (1)` — baseline เขียวก่อนเริ่มแก้

---

### Task 1: Regression test + แก้บั๊ก handoff ไม่ broadcast `mode_change`

**บั๊ก:** `triggerHandoff()` เปลี่ยน `mode = 'waiting_handoff'` แต่ไม่ broadcast; ส่วน `handleMessageEvent()` broadcast `conversation_update` (engine.ts:148) **ก่อน** `routeBotMessage()` (engine.ts:156) ดังนั้น inbox แอดมิน refetch ตอนที่ยังเป็น `bot_active` แล้วไม่ได้รับสัญญาณอีกเลย — ห้องที่ผู้ใช้ขอคุยกับเจ้าหน้าที่ค้างเป็น "บอท" จนกว่าจะมีข้อความถัดไป

**Files:**
- Modify: `src/lib/line/bot/handoff.ts:1-26`
- Test: `src/lib/line/bot/handoff.test.ts`

**Interfaces:**
- Consumes: `broadcast(event: SseEvent): void` จาก `src/lib/line/sse/broadcaster.ts`
- Produces: `triggerHandoff(conversationId: string): Promise<LineOutgoingMessage[]>` (signature เดิม) ที่ broadcast `{ type: 'mode_change', conversationId, payload: { mode: 'waiting_handoff' } }`

- [ ] **Step 1: เขียน failing test**

แก้ส่วนบนของ `src/lib/line/bot/handoff.test.ts` (บรรทัด 1-12) เป็น:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// mock DB ที่รองรับทั้ง `await …where()` และ `…where().returning()` —
// ให้เทสต์นี้ใช้ต่อได้หลัง Task 7 ย้าย triggerHandoff ไปใช้ changeMode
const dbMocks = vi.hoisted(() => {
  const returning = vi.fn(async (): Promise<unknown[]> => [{ id: 'conv-1' }]);
  const where = vi.fn(() => Object.assign(Promise.resolve(undefined), { returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const limit = vi.fn(async (): Promise<unknown[]> => []);
  const select = vi.fn(() => ({ from: () => ({ where: () => ({ limit }) }) }));
  return { returning, where, set, update, limit, select };
});

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => ({ update: dbMocks.update, select: dbMocks.select })),
}));

vi.mock('../sse/broadcaster', () => ({ broadcast: vi.fn() }));

vi.mock('../settings', () => ({
  getChatSetting: vi.fn(async (key: string) => {
    if (key === 'handoff_keywords') {
      return ['ติดต่อเจ้าหน้าที่', 'เจ้าหน้าที่', 'คุยกับคน', 'พบเจ้าหน้าที่', 'handoff', 'operator', 'admin'];
    }
    return null;
  }),
}));

import { isHandoffRequest, triggerHandoff } from './handoff';
import { broadcast } from '../sse/broadcaster';
```

แล้วต่อท้ายไฟล์ (หลัง `describe('isHandoffRequest', …)` ที่มีอยู่):

```ts
describe('triggerHandoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('§ broadcast mode_change หลังเปลี่ยนเป็น waiting_handoff — inbox แอดมินต้องไม่ค้าง bot_active', async () => {
    const replies = await triggerHandoff('conv-1');

    expect(dbMocks.set).toHaveBeenCalledWith(expect.objectContaining({ mode: 'waiting_handoff' }));
    expect(broadcast).toHaveBeenCalledWith({
      type: 'mode_change',
      conversationId: 'conv-1',
      payload: { mode: 'waiting_handoff' },
    });
    expect(replies[0]!.type).toBe('flex');
    expect(replies[1]).toEqual({ type: 'text', text: 'ระบบได้แจ้งเจ้าหน้าที่แล้วครับ กรุณารอสักครู่' });
  });
});
```

- [ ] **Step 2: รันให้เห็นว่า fail**

Run: `npx vitest run src/lib/line/bot/handoff.test.ts`
Expected: FAIL ที่ `triggerHandoff > § broadcast mode_change …` ด้วย `AssertionError: expected "spy" to be called with arguments: [ { type: 'mode_change', … } ]` และ `Number of calls: 0`; เทสต์ `isHandoffRequest` ทั้งหมดยังผ่าน

- [ ] **Step 3: แก้ให้น้อยที่สุด**

แทนที่ `src/lib/line/bot/handoff.ts` ทั้งไฟล์ด้วย:

```ts
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatConversations } from '@/lib/db/schema';
import type { LineOutgoingMessage } from '../types';
import { handoffNotifyFlex } from '../messages/flex';
import { getChatSetting } from '../settings';
import { broadcast } from '../sse/broadcaster';

export async function isHandoffRequest(text: string): Promise<boolean> {
  const keywords = await getChatSetting('handoff_keywords');
  const normalized = text.toLowerCase().trim();
  return keywords.some((kw) => normalized.includes(kw.toLowerCase()));
}

export async function triggerHandoff(conversationId: string): Promise<LineOutgoingMessage[]> {
  const db = await getDb();

  await db
    .update(chatConversations)
    .set({ mode: 'waiting_handoff', updatedAt: new Date() })
    .where(eq(chatConversations.id, conversationId));

  // § ต้อง broadcast เอง — engine ส่ง conversation_update ไปก่อน route ถึง handoff
  // ถ้าไม่ส่ง mode_change ตรงนี้ inbox แอดมินจะค้างโหมด bot_active
  broadcast({ type: 'mode_change', conversationId, payload: { mode: 'waiting_handoff' } });

  return [
    handoffNotifyFlex(),
    { type: 'text', text: 'ระบบได้แจ้งเจ้าหน้าที่แล้วครับ กรุณารอสักครู่' },
  ];
}
```

- [ ] **Step 4: รันให้ผ่าน + เทสต์ engine ไม่พัง**

Run: `npx vitest run src/lib/line/bot/handoff.test.ts src/lib/line/bot/engine.test.ts`
Expected: `Test Files  2 passed (2)`

- [ ] **Step 5: Commit**

```bash
git add src/lib/line/bot/handoff.ts src/lib/line/bot/handoff.test.ts
git commit -m "fix(line): broadcast mode_change เมื่อ handoff เป็น waiting_handoff — inbox แอดมินไม่ค้างโหมดบอท"
```

---

### Task 2: ตารางเปลี่ยนโหมดแบบ pure

ตารางนี้สกัดจากพฤติกรรมจริงตอนนี้: claim guard เดิม (`mode IN ('bot_active','waiting_handoff')`), ปุ่มใน `chat-header.tsx` (บอท ↔ เจ้าหน้าที่, ปิดเรื่อง, คืนให้ Bot) และ engine ที่ปล่อยให้ห้อง `resolved` คุยกับบอทต่อได้ (จึงขอ handoff ได้)

**Files:**
- Create: `src/lib/line/conversation/modes.ts`
- Test: `src/lib/line/conversation/modes.test.ts`

**Interfaces:**
- Consumes: `CONVERSATION_MODES`, `ConversationMode` จาก `src/lib/line/chat-modes.ts`
- Produces:
  - `MODE_TRANSITIONS: Readonly<Record<ConversationMode, readonly ConversationMode[]>>`
  - `canTransition(from: ConversationMode, to: ConversationMode): boolean`
  - `allowedSourceModes(to: ConversationMode): ConversationMode[]`
  - `isHumanHandled(mode: ConversationMode): boolean`

- [ ] **Step 1: เขียน failing test**

สร้าง `src/lib/line/conversation/modes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CONVERSATION_MODES } from '../chat-modes';
import { MODE_TRANSITIONS, allowedSourceModes, canTransition, isHumanHandled } from './modes';

describe('MODE_TRANSITIONS', () => {
  it('มี entry ครบทุกโหมด', () => {
    expect(Object.keys(MODE_TRANSITIONS).sort()).toEqual([...CONVERSATION_MODES].sort());
  });

  it('ไม่มี self-transition (เปลี่ยนเป็นโหมดเดิมจัดการเป็น idempotent ใน service)', () => {
    for (const mode of CONVERSATION_MODES) {
      expect(canTransition(mode, mode)).toBe(false);
    }
  });
});

describe('canTransition', () => {
  it.each([
    ['bot_active', 'waiting_handoff'],
    ['bot_active', 'human_active'],
    ['bot_active', 'resolved'],
    ['waiting_handoff', 'human_active'],
    ['waiting_handoff', 'bot_active'],
    ['waiting_handoff', 'resolved'],
    ['human_active', 'bot_active'],
    ['human_active', 'resolved'],
    ['resolved', 'bot_active'],
    ['resolved', 'waiting_handoff'],
  ] as const)('%s → %s ได้', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['human_active', 'waiting_handoff'],
    ['resolved', 'human_active'],
  ] as const)('%s → %s ไม่ได้', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});

describe('allowedSourceModes', () => {
  it('§ human_active รับได้จาก bot_active/waiting_handoff เท่านั้น — ตรงกับ claim guard เดิมใน PATCH', () => {
    expect(allowedSourceModes('human_active')).toEqual(['bot_active', 'waiting_handoff']);
  });

  it('waiting_handoff มาได้จาก bot_active และ resolved', () => {
    expect(allowedSourceModes('waiting_handoff')).toEqual(['bot_active', 'resolved']);
  });
});

describe('isHumanHandled', () => {
  it('human_active และ waiting_handoff = บอทเงียบ + นับ unread ให้แอดมิน', () => {
    expect(isHumanHandled('human_active')).toBe(true);
    expect(isHumanHandled('waiting_handoff')).toBe(true);
    expect(isHumanHandled('bot_active')).toBe(false);
    expect(isHumanHandled('resolved')).toBe(false);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่า fail**

Run: `npx vitest run src/lib/line/conversation/modes.test.ts`
Expected: FAIL — `Failed to resolve import "./modes"` (ไฟล์ยังไม่มี)

- [ ] **Step 3: เขียน implementation**

สร้าง `src/lib/line/conversation/modes.ts`:

```ts
/**
 * ตารางเปลี่ยนโหมดบทสนทนา LINE — ผู้ตัดสินเดียวว่าเปลี่ยนจากโหมดไหนไปโหมดไหนได้
 *
 * pure module (import แค่ chat-modes ที่ pure เหมือนกัน) — ใช้ได้ทั้งฝั่ง server และ client
 * pgEnum ไม่บังคับ transition — mode-service แปลงตารางนี้เป็น WHERE mode IN (…) แบบ atomic
 */
import { CONVERSATION_MODES, type ConversationMode } from '../chat-modes';

export const MODE_TRANSITIONS: Readonly<Record<ConversationMode, readonly ConversationMode[]>> = {
  bot_active: ['waiting_handoff', 'human_active', 'resolved'],
  waiting_handoff: ['bot_active', 'human_active', 'resolved'],
  human_active: ['bot_active', 'resolved'],
  // § resolved → waiting_handoff ต้องได้ — engine ปล่อยห้องที่ปิดแล้วคุยกับบอทต่อ
  // ผู้ใช้จึงพิมพ์ "ติดต่อเจ้าหน้าที่" จากห้อง resolved ได้
  resolved: ['bot_active', 'waiting_handoff'],
};

export function canTransition(from: ConversationMode, to: ConversationMode): boolean {
  return MODE_TRANSITIONS[from].includes(to);
}

/** โหมดต้นทางทั้งหมดที่เปลี่ยนมาเป็น `to` ได้ — ใช้สร้าง atomic guard ใน UPDATE */
export function allowedSourceModes(to: ConversationMode): ConversationMode[] {
  return CONVERSATION_MODES.filter((from) => canTransition(from, to));
}

/** โหมดที่เจ้าหน้าที่ดูแล: บอทต้องเงียบ และข้อความเข้าต้องนับ unread ให้แอดมิน */
export function isHumanHandled(mode: ConversationMode): boolean {
  return mode === 'human_active' || mode === 'waiting_handoff';
}
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run src/lib/line/conversation/modes.test.ts`
Expected: `Test Files  1 passed (1)`, `Tests  15 passed (15)`

- [ ] **Step 5: Commit**

```bash
git add src/lib/line/conversation/modes.ts src/lib/line/conversation/modes.test.ts
git commit -m "feat(line): ตารางเปลี่ยนโหมดบทสนทนาแบบ pure (conversation/modes)"
```

---

### Task 3: Port `LineTransport` + adapter HTTP และ in-memory

seam นี้มีสอง adapter จริงตั้งแต่วันแรก: HTTP (prod, ห่อ `client.ts` เดิมไม่แก้) และ recording (เทสต์ engine/message-service แทน `vi.mock('../client')`)

**Files:**
- Create: `src/lib/line/conversation/transport.ts`
- Create: `src/lib/line/conversation/recording-transport.ts`
- Test: `src/lib/line/conversation/transport.test.ts`

**Interfaces:**
- Consumes: `replyMessage`, `pushMessage`, `sendTypingIndicator`, `getProfile` จาก `src/lib/line/client.ts`; `LineOutgoingMessage`, `LineProfile` จาก `src/lib/line/types.ts`
- Produces:
  - `interface LineTransport { reply(replyToken: string, messages: LineOutgoingMessage[]): Promise<void>; push(to: string, messages: LineOutgoingMessage[]): Promise<void>; showTyping(chatId: string): Promise<void>; getProfile(userId: string): Promise<LineProfile | null> }`
  - `httpLineTransport: LineTransport`
  - `type TransportCall = { kind: 'reply'; replyToken; messages } | { kind: 'push'; to; messages } | { kind: 'typing'; chatId } | { kind: 'profile'; userId }`
  - `interface RecordingTransport extends LineTransport { readonly calls: readonly TransportCall[]; failNextPush(error?: Error): void; setProfile(profile: LineProfile | null): void }`
  - `createRecordingTransport(): RecordingTransport`

- [ ] **Step 1: เขียน failing test**

สร้าง `src/lib/line/conversation/transport.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpLineTransport } from './transport';
import { createRecordingTransport } from './recording-transport';

const TEXT = [{ type: 'text' as const, text: 'สวัสดีครับ' }];

describe('httpLineTransport (adapter prod — ห่อ client.ts)', () => {
  const fetchMock = vi.fn<typeof fetch>();

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('push → POST /message/push พร้อม to + messages', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }));

    await httpLineTransport.push('U123', TEXT);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://api.line.me/v2/bot/message/push');
    expect(JSON.parse(String(init?.body))).toEqual({ to: 'U123', messages: TEXT });
  });

  it('reply → POST /message/reply พร้อม replyToken', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }));

    await httpLineTransport.reply('rt-1', TEXT);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://api.line.me/v2/bot/message/reply');
    expect(JSON.parse(String(init?.body))).toEqual({ replyToken: 'rt-1', messages: TEXT });
  });

  it('push ที่ LINE ตอบ non-2xx ต้อง throw (message-service ใช้ตัดสิน pushStatus=failed)', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation(async () => new Response('boom', { status: 500 }));

    await expect(httpLineTransport.push('U123', TEXT)).rejects.toThrow('LINE API /message/push failed (500)');
  });
});

describe('createRecordingTransport (adapter เทสต์)', () => {
  it('บันทึกทุก call ตามลำดับ', async () => {
    const t = createRecordingTransport();
    await t.getProfile('U1');
    await t.showTyping('U1');
    await t.reply('rt', TEXT);
    await t.push('U1', TEXT);

    expect(t.calls).toEqual([
      { kind: 'profile', userId: 'U1' },
      { kind: 'typing', chatId: 'U1' },
      { kind: 'reply', replyToken: 'rt', messages: TEXT },
      { kind: 'push', to: 'U1', messages: TEXT },
    ]);
  });

  it('failNextPush ทำให้ push ครั้งถัดไป throw ครั้งเดียว แต่ยังบันทึก call', async () => {
    const t = createRecordingTransport();
    t.failNextPush();

    await expect(t.push('U1', TEXT)).rejects.toThrow('push ล้มเหลว (จำลอง)');
    await expect(t.push('U1', TEXT)).resolves.toBeUndefined();
    expect(t.calls.filter((c) => c.kind === 'push')).toHaveLength(2);
  });

  it('getProfile คืนค่าที่ตั้งด้วย setProfile (default null)', async () => {
    const t = createRecordingTransport();
    expect(await t.getProfile('U1')).toBeNull();
    t.setProfile({ userId: 'U1', displayName: 'สมชาย' } as never);
    expect(await t.getProfile('U1')).toMatchObject({ displayName: 'สมชาย' });
  });
});
```

- [ ] **Step 2: รันให้เห็นว่า fail**

Run: `npx vitest run src/lib/line/conversation/transport.test.ts`
Expected: FAIL — `Failed to resolve import "./transport"`

- [ ] **Step 3: เขียน implementation**

สร้าง `src/lib/line/conversation/transport.ts`:

```ts
import { getProfile, pushMessage, replyMessage, sendTypingIndicator } from '../client';
import type { LineOutgoingMessage, LineProfile } from '../types';

/**
 * port ไป LINE Messaging API — module บทสนทนาและ bot engine คุยกับ LINE ผ่าน interface นี้
 * adapter: httpLineTransport (prod) และ createRecordingTransport() (เทสต์ — recording-transport.ts)
 */
export interface LineTransport {
  reply(replyToken: string, messages: LineOutgoingMessage[]): Promise<void>;
  push(to: string, messages: LineOutgoingMessage[]): Promise<void>;
  /** best-effort — client.ts กลืน error เอง ไม่ล้ม flow ตอบข้อความ */
  showTyping(chatId: string): Promise<void>;
  getProfile(userId: string): Promise<LineProfile | null>;
}

export const httpLineTransport: LineTransport = {
  reply: replyMessage,
  push: pushMessage,
  showTyping: (chatId) => sendTypingIndicator(chatId),
  getProfile,
};
```

สร้าง `src/lib/line/conversation/recording-transport.ts`:

```ts
import type { LineOutgoingMessage, LineProfile } from '../types';
import type { LineTransport } from './transport';

/** adapter in-memory สำหรับเทสต์ — บันทึกทุก call แทนการยิง LINE จริง */
export type TransportCall =
  | { kind: 'reply'; replyToken: string; messages: LineOutgoingMessage[] }
  | { kind: 'push'; to: string; messages: LineOutgoingMessage[] }
  | { kind: 'typing'; chatId: string }
  | { kind: 'profile'; userId: string };

export interface RecordingTransport extends LineTransport {
  readonly calls: readonly TransportCall[];
  /** ให้ push ครั้งถัดไป throw (จำลอง LINE ล่ม) — ครั้งเดียวแล้วกลับเป็นปกติ */
  failNextPush(error?: Error): void;
  setProfile(profile: LineProfile | null): void;
}

export function createRecordingTransport(): RecordingTransport {
  const calls: TransportCall[] = [];
  let pendingPushError: Error | null = null;
  let profile: LineProfile | null = null;

  return {
    get calls() {
      return calls;
    },
    failNextPush(error = new Error('push ล้มเหลว (จำลอง)')) {
      pendingPushError = error;
    },
    setProfile(next) {
      profile = next;
    },
    async reply(replyToken, messages) {
      calls.push({ kind: 'reply', replyToken, messages });
    },
    async push(to, messages) {
      calls.push({ kind: 'push', to, messages });
      if (pendingPushError) {
        const error = pendingPushError;
        pendingPushError = null;
        throw error;
      }
    },
    async showTyping(chatId) {
      calls.push({ kind: 'typing', chatId });
    },
    async getProfile(userId) {
      calls.push({ kind: 'profile', userId });
      return profile;
    },
  };
}
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run src/lib/line/conversation/transport.test.ts`
Expected: `Test Files  1 passed (1)`, `Tests  6 passed (6)`

- [ ] **Step 5: Commit**

```bash
git add src/lib/line/conversation/transport.ts src/lib/line/conversation/recording-transport.ts src/lib/line/conversation/transport.test.ts
git commit -m "feat(line): port LineTransport + adapter HTTP และ recording สำหรับเทสต์"
```

---

### Task 4: `mode-service` — เปลี่ยนโหมด/โอนห้อง/ผูกเคส แบบ atomic + broadcast ทุกครั้ง

**Files:**
- Create: `src/lib/line/conversation/mode-service.ts`
- Create: `src/lib/line/conversation/index.ts`
- Test: `src/lib/line/conversation/mode-service.integration.test.ts`

**Interfaces:**
- Consumes: `allowedSourceModes` (Task 2), `broadcast` จาก `../sse/broadcaster`, `getDb`, `firstOrUndefined`
- Produces:
  - `type ModeChangeResult = { ok: true; changed: boolean } | { ok: false; reason: 'not_found' } | { ok: false; reason: 'conflict'; currentMode: ConversationMode }`
  - `interface ChangeModeOptions { actorAdminId?: string; linkedCaseId?: string | null }`
  - `changeMode(conversationId: string, to: ConversationMode, opts?: ChangeModeOptions): Promise<ModeChangeResult>` — throw ถ้า `to === 'human_active'` แต่ไม่มี `actorAdminId`
  - `interface TransferInput { toAdminId: string; byAdminId: string; reason?: string }`
  - `transferOwnership(conversationId: string, input: TransferInput): Promise<ModeChangeResult>`
  - `type LinkCaseResult = { ok: true } | { ok: false; reason: 'not_found' }`
  - `linkCase(conversationId: string, linkedCaseId: string | null): Promise<LinkCaseResult>`
  - barrel `src/lib/line/conversation/index.ts`

- [ ] **Step 1: เขียน failing integration test**

สร้าง `src/lib/line/conversation/mode-service.integration.test.ts`:

```ts
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { chatConversations } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import type { ConversationMode } from '../chat-modes';

vi.mock('../sse/broadcaster', () => ({ broadcast: vi.fn() }));

import { broadcast } from '../sse/broadcaster';
import { changeMode, linkCase, transferOwnership } from './mode-service';

const ADMIN_A = generateId();
const ADMIN_B = generateId();
const created: string[] = [];

async function createConv(mode: ConversationMode, assignedAdminId: string | null = null): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.insert(chatConversations).values({ id, lineUserId: `it-mode-${id}`, mode, assignedAdminId });
  created.push(id);
  return id;
}

async function loadConv(id: string) {
  const db = await getDb();
  const [conv] = await db.select().from(chatConversations).where(eq(chatConversations.id, id));
  if (!conv) throw new Error('conversation หายจาก DB ระหว่างเทสต์');
  return conv;
}

beforeEach(() => {
  vi.mocked(broadcast).mockClear();
});

afterAll(async () => {
  const db = await getDb();
  if (created.length > 0) {
    await db.delete(chatConversations).where(inArray(chatConversations.id, created));
  }
  await closeDb();
});

describe('changeMode', () => {
  test('claim: bot_active → human_active ตั้งเจ้าของห้อง + broadcast mode_change', async () => {
    const id = await createConv('bot_active');

    const result = await changeMode(id, 'human_active', { actorAdminId: ADMIN_A });

    expect(result).toEqual({ ok: true, changed: true });
    const conv = await loadConv(id);
    expect(conv.mode).toBe('human_active');
    expect(conv.assignedAdminId).toBe(ADMIN_A);
    expect(conv.assignedAt).toBeInstanceOf(Date);
    expect(broadcast).toHaveBeenCalledWith({
      type: 'mode_change',
      conversationId: id,
      payload: { mode: 'human_active', assignedAdminId: ADMIN_A },
    });
  });

  test('claim ซ้อน: แอดมินอื่นได้ conflict; เจ้าของเดิมได้ idempotent และไม่ broadcast', async () => {
    const id = await createConv('human_active', ADMIN_A);

    expect(await changeMode(id, 'human_active', { actorAdminId: ADMIN_B })).toEqual({
      ok: false,
      reason: 'conflict',
      currentMode: 'human_active',
    });
    expect(await changeMode(id, 'human_active', { actorAdminId: ADMIN_A })).toEqual({
      ok: true,
      changed: false,
    });
    expect(broadcast).not.toHaveBeenCalled();
    expect((await loadConv(id)).assignedAdminId).toBe(ADMIN_A);
  });

  test('handoff: bot_active → waiting_handoff broadcast payload มีแค่ mode', async () => {
    const id = await createConv('bot_active');

    expect(await changeMode(id, 'waiting_handoff')).toEqual({ ok: true, changed: true });
    expect(broadcast).toHaveBeenCalledWith({
      type: 'mode_change',
      conversationId: id,
      payload: { mode: 'waiting_handoff' },
    });
  });

  test('resolved → waiting_handoff ได้ (ผู้ใช้ทักห้องที่ปิดแล้วขอคุยกับเจ้าหน้าที่)', async () => {
    const id = await createConv('resolved');
    expect(await changeMode(id, 'waiting_handoff')).toEqual({ ok: true, changed: true });
    expect((await loadConv(id)).mode).toBe('waiting_handoff');
  });

  test('human_active → resolved ตั้ง resolvedAt', async () => {
    const id = await createConv('human_active', ADMIN_A);
    expect(await changeMode(id, 'resolved')).toEqual({ ok: true, changed: true });
    const conv = await loadConv(id);
    expect(conv.mode).toBe('resolved');
    expect(conv.resolvedAt).toBeInstanceOf(Date);
  });

  test('§ resolved → human_active เป็น conflict — ตรงกับ claim guard เดิม', async () => {
    const id = await createConv('resolved');
    expect(await changeMode(id, 'human_active', { actorAdminId: ADMIN_A })).toEqual({
      ok: false,
      reason: 'conflict',
      currentMode: 'resolved',
    });
    expect((await loadConv(id)).mode).toBe('resolved');
  });

  test('เปลี่ยนเป็นโหมดเดิม (bot_active → bot_active) idempotent ไม่ broadcast', async () => {
    const id = await createConv('bot_active');
    expect(await changeMode(id, 'bot_active')).toEqual({ ok: true, changed: false });
    expect(broadcast).not.toHaveBeenCalled();
  });

  test('linkedCaseId ไปพร้อม mode ใน UPDATE เดียว', async () => {
    const id = await createConv('human_active', ADMIN_A);
    const caseId = generateId();

    expect(await changeMode(id, 'resolved', { linkedCaseId: caseId })).toEqual({ ok: true, changed: true });
    expect((await loadConv(id)).linkedCaseId).toBe(caseId);
    expect(broadcast).toHaveBeenCalledWith({
      type: 'mode_change',
      conversationId: id,
      payload: { mode: 'resolved', linkedCaseId: caseId },
    });
  });

  test('ห้องที่ไม่มีอยู่ → not_found', async () => {
    expect(await changeMode(generateId(), 'resolved')).toEqual({ ok: false, reason: 'not_found' });
  });

  test('human_active โดยไม่ระบุ actorAdminId → throw (bug ของผู้เรียก ไม่ใช่ input ผู้ใช้)', async () => {
    const id = await createConv('bot_active');
    await expect(changeMode(id, 'human_active')).rejects.toThrow('actorAdminId');
  });
});

describe('transferOwnership', () => {
  test('โอนห้อง human_active + ต่อท้าย metadata.transfers + broadcast', async () => {
    const id = await createConv('human_active', ADMIN_A);

    const result = await transferOwnership(id, { toAdminId: ADMIN_B, byAdminId: ADMIN_A, reason: 'ทดสอบโอนเวร' });

    expect(result).toEqual({ ok: true, changed: true });
    const conv = await loadConv(id);
    expect(conv.assignedAdminId).toBe(ADMIN_B);
    const transfers = (conv.metadata as { transfers?: unknown[] } | null)?.transfers;
    expect(transfers).toHaveLength(1);
    expect(transfers?.[0]).toMatchObject({ toAdminId: ADMIN_B, byAdminId: ADMIN_A, reason: 'ทดสอบโอนเวร' });
    expect(broadcast).toHaveBeenCalledWith({
      type: 'mode_change',
      conversationId: id,
      payload: { mode: 'human_active', assignedAdminId: ADMIN_B },
    });
  });

  test('ห้องที่ไม่ใช่ human_active → conflict', async () => {
    const id = await createConv('resolved');
    expect(await transferOwnership(id, { toAdminId: ADMIN_B, byAdminId: ADMIN_A })).toEqual({
      ok: false,
      reason: 'conflict',
      currentMode: 'resolved',
    });
    expect(broadcast).not.toHaveBeenCalled();
  });

  test('ห้องที่ไม่มีอยู่ → not_found', async () => {
    expect(await transferOwnership(generateId(), { toAdminId: ADMIN_B, byAdminId: ADMIN_A })).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });
});

describe('linkCase', () => {
  test('ผูก/ปลดเคสโดยไม่เปลี่ยนโหมด + broadcast', async () => {
    const id = await createConv('bot_active');
    const caseId = generateId();

    expect(await linkCase(id, caseId)).toEqual({ ok: true });
    expect((await loadConv(id)).linkedCaseId).toBe(caseId);
    expect((await loadConv(id)).mode).toBe('bot_active');
    expect(broadcast).toHaveBeenCalledWith({
      type: 'mode_change',
      conversationId: id,
      payload: { linkedCaseId: caseId },
    });

    expect(await linkCase(id, null)).toEqual({ ok: true });
    expect((await loadConv(id)).linkedCaseId).toBeNull();
  });

  test('ห้องที่ไม่มีอยู่ → not_found', async () => {
    expect(await linkCase(generateId(), null)).toEqual({ ok: false, reason: 'not_found' });
  });
});
```

- [ ] **Step 2: รันให้เห็นว่า fail**

Run: `npx vitest run src/lib/line/conversation/mode-service.integration.test.ts`
Expected: FAIL — `Failed to resolve import "./mode-service"`

- [ ] **Step 3: เขียน implementation**

สร้าง `src/lib/line/conversation/mode-service.ts`:

```ts
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDb, type Db } from '@/lib/db';
import { chatConversations } from '@/lib/db/schema';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import type { ConversationMode } from '../chat-modes';
import { broadcast } from '../sse/broadcaster';
import { allowedSourceModes } from './modes';

export type ModeChangeResult =
  | { ok: true; changed: boolean }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'conflict'; currentMode: ConversationMode };

export interface ChangeModeOptions {
  /** แอดมินที่สั่ง — บังคับเมื่อ to = human_active (กลายเป็นเจ้าของห้อง) */
  actorAdminId?: string;
  /** ผูกเคสไปพร้อมกันใน UPDATE เดียว (PATCH ส่ง mode + linkedCaseId มาพร้อมกันได้) */
  linkedCaseId?: string | null;
}

export interface TransferInput {
  toAdminId: string;
  byAdminId: string;
  reason?: string;
}

export type LinkCaseResult = { ok: true } | { ok: false; reason: 'not_found' };

async function findModeRow(db: Db, conversationId: string) {
  return firstOrUndefined(
    db
      .select({ mode: chatConversations.mode, assignedAdminId: chatConversations.assignedAdminId })
      .from(chatConversations)
      .where(eq(chatConversations.id, conversationId))
      .limit(1),
  );
}

function buildModeUpdates(to: ConversationMode, opts: ChangeModeOptions, now: Date) {
  return {
    mode: to,
    updatedAt: now,
    ...(to === 'human_active' ? { assignedAdminId: opts.actorAdminId, assignedAt: now } : {}),
    ...(to === 'resolved' ? { resolvedAt: now } : {}),
    ...(opts.linkedCaseId !== undefined ? { linkedCaseId: opts.linkedCaseId } : {}),
  } satisfies Partial<typeof chatConversations.$inferInsert>;
}

/**
 * เปลี่ยนโหมดบทสนทนา — ทางเดียวที่ควรใช้เปลี่ยน chat_conversations.mode
 *
 * § guard อยู่ใน WHERE (atomic) — สองแอดมินกดรับพร้อมกัน คนหลังได้ conflict ไม่ทับเงียบ ๆ
 * § broadcast mode_change ทุกครั้งที่เปลี่ยนจริง — เดิม handoff ลืม broadcast ทำ inbox ค้าง
 */
export async function changeMode(
  conversationId: string,
  to: ConversationMode,
  opts: ChangeModeOptions = {},
): Promise<ModeChangeResult> {
  if (to === 'human_active' && !opts.actorAdminId) {
    throw new Error('changeMode(human_active) ต้องระบุ actorAdminId');
  }

  const db = await getDb();
  const [updated] = await db
    .update(chatConversations)
    .set(buildModeUpdates(to, opts, new Date()))
    .where(and(eq(chatConversations.id, conversationId), inArray(chatConversations.mode, allowedSourceModes(to))))
    .returning({ id: chatConversations.id });

  if (updated) {
    broadcast({
      type: 'mode_change',
      conversationId,
      payload: {
        mode: to,
        ...(to === 'human_active' ? { assignedAdminId: opts.actorAdminId } : {}),
        ...(opts.linkedCaseId !== undefined ? { linkedCaseId: opts.linkedCaseId } : {}),
      },
    });
    return { ok: true, changed: true };
  }

  const existing = await findModeRow(db, conversationId);
  if (!existing) return { ok: false, reason: 'not_found' };

  // idempotent: อยู่ในโหมดปลายทางแล้ว — human_active ต้องเป็นเจ้าของคนเดิมเท่านั้น
  const alreadyThere =
    existing.mode === to && (to !== 'human_active' || existing.assignedAdminId === opts.actorAdminId);
  if (!alreadyThere) return { ok: false, reason: 'conflict', currentMode: existing.mode };

  // § idempotent = ไม่ update — ผูกเคสต้องไปทาง linkCase แยก ไม่ทำซ้ำใน path นี้
  return { ok: true, changed: false };
}

/** โอนห้องที่เจ้าหน้าที่ดูแลอยู่ให้เจ้าหน้าที่อื่น — ผู้เรียกต้องตรวจว่าปลายทางเป็น staff ที่ active เอง */
export async function transferOwnership(
  conversationId: string,
  input: TransferInput,
): Promise<ModeChangeResult> {
  const db = await getDb();
  const now = new Date();
  const transferAudit = {
    toAdminId: input.toAdminId,
    byAdminId: input.byAdminId,
    at: now.toISOString(),
    ...(input.reason ? { reason: input.reason } : {}),
  };

  const [transferred] = await db
    .update(chatConversations)
    .set({
      assignedAdminId: input.toAdminId,
      assignedAt: now,
      updatedAt: now,
      metadata: sql`jsonb_set(
        coalesce(${chatConversations.metadata}, '{}'::jsonb),
        '{transfers}',
        coalesce(${chatConversations.metadata} -> 'transfers', '[]'::jsonb) || ${JSON.stringify(transferAudit)}::jsonb
      )`,
    })
    // atomic guard: โอนได้เฉพาะห้องที่เจ้าหน้าที่กำลังดูแลอยู่จริง
    .where(and(eq(chatConversations.id, conversationId), eq(chatConversations.mode, 'human_active')))
    .returning({ id: chatConversations.id });

  if (transferred) {
    broadcast({
      type: 'mode_change',
      conversationId,
      payload: { mode: 'human_active', assignedAdminId: input.toAdminId },
    });
    return { ok: true, changed: true };
  }

  const existing = await findModeRow(db, conversationId);
  if (!existing) return { ok: false, reason: 'not_found' };
  return { ok: false, reason: 'conflict', currentMode: existing.mode };
}

/** ผูก/ปลดเคสกับบทสนทนาโดยไม่เปลี่ยนโหมด */
export async function linkCase(conversationId: string, linkedCaseId: string | null): Promise<LinkCaseResult> {
  const db = await getDb();
  const [linked] = await db
    .update(chatConversations)
    .set({ linkedCaseId, updatedAt: new Date() })
    .where(eq(chatConversations.id, conversationId))
    .returning({ id: chatConversations.id });

  if (!linked) return { ok: false, reason: 'not_found' };

  // § คงชนิด mode_change ตาม PATCH เดิม — client refetch inbox เหมือนกันทั้งสองชนิด
  broadcast({ type: 'mode_change', conversationId, payload: { linkedCaseId } });
  return { ok: true };
}
```

สร้าง `src/lib/line/conversation/index.ts`:

```ts
/**
 * Conversation module — เจ้าของโหมดบทสนทนา LINE และการบันทึกข้อความ + broadcast
 * ผู้เรียก (bot engine, admin routes) ใช้ผ่านไฟล์นี้; recording-transport import ตรงจากเทสต์เท่านั้น
 */
export { MODE_TRANSITIONS, allowedSourceModes, canTransition, isHumanHandled } from './modes';
export { httpLineTransport, type LineTransport } from './transport';
export {
  changeMode,
  linkCase,
  transferOwnership,
  type ChangeModeOptions,
  type LinkCaseResult,
  type ModeChangeResult,
  type TransferInput,
} from './mode-service';
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run src/lib/line/conversation/mode-service.integration.test.ts`
Expected: `Test Files  1 passed (1)`, `Tests  15 passed (15)`

ถ้าได้ `DATABASE_URL is not set` หรือ `ECONNREFUSED 127.0.0.1:5433` → รัน `docker compose up -d postgres redis up-redis` แล้วรันใหม่

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: ไม่มี output (exit 0)

- [ ] **Step 6: Commit**

```bash
git add src/lib/line/conversation/mode-service.ts src/lib/line/conversation/mode-service.integration.test.ts src/lib/line/conversation/index.ts
git commit -m "feat(line): conversation mode-service — เปลี่ยนโหมด/โอนห้อง/ผูกเคสแบบ atomic + broadcast"
```

---

### Task 5: `message-service` — บันทึกข้อความขาเข้า (ผู้ใช้) และคำตอบบอท

**Files:**
- Create: `src/lib/line/conversation/message-service.ts`
- Modify: `src/lib/line/conversation/index.ts`
- Test: `src/lib/line/conversation/message-service.integration.test.ts`

**Interfaces:**
- Consumes: `isHumanHandled` (Task 2), `broadcast`, `getDb`, `generateId`
- Produces:
  - `type InboundMessageType = 'text' | 'image' | 'location' | 'sticker'`
  - `interface InboundMessage { conversationId: string; mode: ConversationMode; messageType: InboundMessageType; textContent: string | null; locationData: Record<string, unknown> | null; lineMessageId: string }`
  - `recordInboundMessage(input: InboundMessage): Promise<{ messageId: string }>` — insert + อัปเดต last message/unread + broadcast `new_message` แล้ว `conversation_update`
  - `recordBotReplies(conversationId: string, replies: LineOutgoingMessage[]): Promise<void>` — insert แถว `sender='bot'` (คงพฤติกรรมเดิม: ไม่อัปเดต last message ไม่ broadcast)

- [ ] **Step 1: เขียน failing integration test**

สร้าง `src/lib/line/conversation/message-service.integration.test.ts`:

```ts
import { asc, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { chatConversations, chatMessages } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import type { ConversationMode } from '../chat-modes';

vi.mock('../sse/broadcaster', () => ({ broadcast: vi.fn() }));

import { broadcast } from '../sse/broadcaster';
import { recordBotReplies, recordInboundMessage } from './message-service';

const created: string[] = [];

async function createConv(mode: ConversationMode, unreadAdmin = 0): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.insert(chatConversations).values({ id, lineUserId: `it-msg-${id}`, mode, unreadAdmin });
  created.push(id);
  return id;
}

async function loadConv(id: string) {
  const db = await getDb();
  const [conv] = await db.select().from(chatConversations).where(eq(chatConversations.id, id));
  if (!conv) throw new Error('conversation หายจาก DB ระหว่างเทสต์');
  return conv;
}

async function loadMessages(conversationId: string) {
  const db = await getDb();
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(asc(chatMessages.id));
}

beforeEach(() => {
  vi.mocked(broadcast).mockClear();
});

afterAll(async () => {
  const db = await getDb();
  if (created.length > 0) {
    await db.delete(chatMessages).where(inArray(chatMessages.conversationId, created));
    await db.delete(chatConversations).where(inArray(chatConversations.id, created));
  }
  await closeDb();
});

describe('recordInboundMessage', () => {
  test('bot_active: บันทึกข้อความ + last message + unread=0 + broadcast new_message แล้ว conversation_update', async () => {
    const id = await createConv('bot_active', 3);

    const { messageId } = await recordInboundMessage({
      conversationId: id,
      mode: 'bot_active',
      messageType: 'text',
      textContent: 'ถนนหน้าบ้านพัง',
      locationData: null,
      lineMessageId: 'line-msg-1',
    });

    const [msg] = await loadMessages(id);
    expect(msg).toMatchObject({ id: messageId, sender: 'user', messageType: 'text', textContent: 'ถนนหน้าบ้านพัง', lineMessageId: 'line-msg-1' });
    const conv = await loadConv(id);
    expect(conv.lastMessageText).toBe('ถนนหน้าบ้านพัง');
    expect(conv.lastMessageSender).toBe('user');
    expect(conv.unreadAdmin).toBe(0);

    const calls = vi.mocked(broadcast).mock.calls.map(([e]) => e);
    expect(calls.map((e) => e.type)).toEqual(['new_message', 'conversation_update']);
    expect(calls[0]).toMatchObject({ conversationId: id, payload: { id: messageId, sender: 'user', textContent: 'ถนนหน้าบ้านพัง' } });
    expect(calls[1]).toEqual({ type: 'conversation_update', conversationId: id, payload: { lastMessageText: 'ถนนหน้าบ้านพัง' } });
  });

  test('human_active: นับ unreadAdmin เพิ่ม', async () => {
    const id = await createConv('human_active', 2);
    await recordInboundMessage({
      conversationId: id,
      mode: 'human_active',
      messageType: 'text',
      textContent: 'ยังรออยู่ครับ',
      locationData: null,
      lineMessageId: 'line-msg-2',
    });
    expect((await loadConv(id)).unreadAdmin).toBe(3);
  });

  test('ข้อความไม่มี text (location) ใช้ "[location]" เป็นข้อความล่าสุด + เก็บ locationData', async () => {
    const id = await createConv('bot_active');
    const locationData = { title: 'บ้าน', address: 'หัวงัว', latitude: 16.4, longitude: 103.3 };
    await recordInboundMessage({
      conversationId: id,
      mode: 'bot_active',
      messageType: 'location',
      textContent: null,
      locationData,
      lineMessageId: 'line-msg-3',
    });
    expect((await loadConv(id)).lastMessageText).toBe('[location]');
    expect((await loadMessages(id))[0]!.locationData).toEqual(locationData);
  });
});

describe('recordBotReplies', () => {
  test('บันทึกทุกคำตอบเป็น sender=bot เรียงตามลำดับ; flex เก็บ flexPayload; ไม่ broadcast', async () => {
    const id = await createConv('bot_active');
    await recordBotReplies(id, [
      { type: 'flex', altText: 'กำลังเชื่อมต่อ', contents: { type: 'bubble' } },
      { type: 'text', text: 'ระบบได้แจ้งเจ้าหน้าที่แล้วครับ' },
    ]);

    const rows = await loadMessages(id);
    expect(rows.map((r) => [r.sender, r.messageType])).toEqual([
      ['bot', 'flex'],
      ['bot', 'text'],
    ]);
    expect(rows[0]!.flexPayload).toEqual({ type: 'bubble' });
    expect(rows[1]!.textContent).toBe('ระบบได้แจ้งเจ้าหน้าที่แล้วครับ');
    expect(broadcast).not.toHaveBeenCalled();
  });

  test('ไม่มีคำตอบ → ไม่ insert อะไร', async () => {
    const id = await createConv('bot_active');
    await recordBotReplies(id, []);
    expect(await loadMessages(id)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่า fail**

Run: `npx vitest run src/lib/line/conversation/message-service.integration.test.ts`
Expected: FAIL — `Failed to resolve import "./message-service"`

- [ ] **Step 3: เขียน implementation**

สร้าง `src/lib/line/conversation/message-service.ts`:

```ts
import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatConversations, chatMessages } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import type { ConversationMode } from '../chat-modes';
import { broadcast } from '../sse/broadcaster';
import type { LineOutgoingMessage } from '../types';
import { isHumanHandled } from './modes';

export type InboundMessageType = 'text' | 'image' | 'location' | 'sticker';

export interface InboundMessage {
  conversationId: string;
  /** โหมด ณ ตอนรับข้อความ — ตัดสินว่าจะนับ unread ให้แอดมินไหม */
  mode: ConversationMode;
  messageType: InboundMessageType;
  textContent: string | null;
  locationData: Record<string, unknown> | null;
  lineMessageId: string;
}

/** บันทึกข้อความจากผู้ใช้ LINE + อัปเดตข้อความล่าสุดของห้อง + แจ้ง inbox แอดมิน */
export async function recordInboundMessage(input: InboundMessage): Promise<{ messageId: string }> {
  const db = await getDb();
  const messageId = generateId();
  const preview = input.textContent ?? `[${input.messageType}]`;

  await db.insert(chatMessages).values({
    id: messageId,
    conversationId: input.conversationId,
    sender: 'user',
    messageType: input.messageType,
    textContent: input.textContent,
    locationData: input.locationData,
    lineMessageId: input.lineMessageId,
  });

  await db
    .update(chatConversations)
    .set({
      lastMessageText: preview,
      lastMessageAt: new Date(),
      lastMessageSender: 'user',
      unreadAdmin: isHumanHandled(input.mode) ? sql`${chatConversations.unreadAdmin} + 1` : 0,
      updatedAt: new Date(),
    })
    .where(eq(chatConversations.id, input.conversationId));

  broadcast({
    type: 'new_message',
    conversationId: input.conversationId,
    payload: {
      id: messageId,
      sender: 'user',
      messageType: input.messageType,
      textContent: input.textContent,
      createdAt: new Date().toISOString(),
    },
  });
  broadcast({ type: 'conversation_update', conversationId: input.conversationId, payload: { lastMessageText: preview } });

  return { messageId };
}

/**
 * บันทึกคำตอบของบอท — คงพฤติกรรมเดิมของ engine: ไม่อัปเดต last message และไม่ broadcast
 * (ข้อความที่ไม่ใช่ text เก็บเป็น messageType 'flex' ตามเดิม)
 */
export async function recordBotReplies(conversationId: string, replies: LineOutgoingMessage[]): Promise<void> {
  if (replies.length === 0) return;
  const db = await getDb();

  await db.insert(chatMessages).values(
    replies.map((reply) => ({
      id: generateId(),
      conversationId,
      sender: 'bot' as const,
      messageType: reply.type === 'text' ? ('text' as const) : ('flex' as const),
      textContent: reply.type === 'text' ? reply.text : null,
      flexPayload: reply.type === 'flex' ? reply.contents : null,
    })),
  );
}
```

ใน `src/lib/line/conversation/index.ts` ต่อท้าย:

```ts
export {
  recordBotReplies,
  recordInboundMessage,
  type InboundMessage,
  type InboundMessageType,
} from './message-service';
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run src/lib/line/conversation/message-service.integration.test.ts`
Expected: `Test Files  1 passed (1)`, `Tests  5 passed (5)`

- [ ] **Step 5: Commit**

```bash
git add src/lib/line/conversation/message-service.ts src/lib/line/conversation/message-service.integration.test.ts src/lib/line/conversation/index.ts
git commit -m "feat(line): conversation message-service — บันทึกข้อความผู้ใช้/บอท + broadcast"
```

---

### Task 6: `message-service` — `sendAdminReply` (idempotent + pushStatus ผ่าน `LineTransport`)

ย้าย logic ของ `messages/route.ts:16-178` มาเป็นฟังก์ชันเดียวที่รับ transport — route จะเหลือแค่ auth + validate + map ผลเป็น HTTP

**Files:**
- Modify: `src/lib/line/conversation/message-service.ts`
- Modify: `src/lib/line/conversation/index.ts`
- Test: `src/lib/line/conversation/message-service.integration.test.ts`

**Interfaces:**
- Consumes: `LineTransport` (Task 3), `createRecordingTransport` (Task 3, ในเทสต์)
- Produces:
  - `type PushStatus = 'pending' | 'sent' | 'failed'` — สถานะใน DB; `pending` มีก่อนส่งเท่านั้น
  - `type PushAttemptStatus = 'sent' | 'failed'` — ผลของ `pushAndRecord` ไม่มี `pending`
  - `interface AdminReplyInput { conversationId: string; adminUserId: string; text: string; clientTempId?: string }`
  - `type AdminReplyResult = { kind: 'not_found' } | { kind: 'sent'; messageId: string; pushStatus: 'sent' } | { kind: 'duplicate'; messageId: string | undefined; pushStatus: PushStatus | undefined } | { kind: 'push_failed'; messageId: string }`
  - `sendAdminReply(input: AdminReplyInput, transport: LineTransport): Promise<AdminReplyResult>`

- [ ] **Step 1: เขียน failing test**

ใน `src/lib/line/conversation/message-service.integration.test.ts` แก้บรรทัด import ของ service และเพิ่ม import recorder:

```ts
import { broadcast } from '../sse/broadcaster';
import { recordBotReplies, recordInboundMessage, sendAdminReply } from './message-service';
import { createRecordingTransport } from './recording-transport';
```

แล้วต่อท้ายไฟล์:

```ts
describe('sendAdminReply', () => {
  const ADMIN = generateId();

  test('ส่งใหม่: push ผ่าน transport + pushStatus=sent + last message เป็น admin + broadcast new_message', async () => {
    const id = await createConv('human_active', 4);
    const transport = createRecordingTransport();

    const result = await sendAdminReply({ conversationId: id, adminUserId: ADMIN, text: 'รับเรื่องแล้วครับ', clientTempId: `t-${id}` }, transport);

    expect(result).toMatchObject({ kind: 'sent', pushStatus: 'sent' });
    expect(transport.calls).toEqual([
      { kind: 'push', to: `it-msg-${id}`, messages: [{ type: 'text', text: 'รับเรื่องแล้วครับ' }] },
    ]);
    const [row] = await loadMessages(id);
    expect(row).toMatchObject({ sender: 'admin', adminUserId: ADMIN, textContent: 'รับเรื่องแล้วครับ', metadata: { pushStatus: 'sent' } });
    const conv = await loadConv(id);
    expect(conv.lastMessageSender).toBe('admin');
    expect(conv.unreadAdmin).toBe(0);
    expect(broadcast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'new_message', conversationId: id, payload: expect.objectContaining({ sender: 'admin', clientTempId: `t-${id}` }) }),
    );
  });

  test('retry ด้วย clientTempId เดิมหลังสำเร็จ → duplicate ไม่ push ซ้ำ ไม่สร้างแถวใหม่', async () => {
    const id = await createConv('human_active');
    const transport = createRecordingTransport();
    const input = { conversationId: id, adminUserId: ADMIN, text: 'ซ้ำ', clientTempId: `t-${id}` };

    const first = await sendAdminReply(input, transport);
    const second = await sendAdminReply(input, transport);

    expect(second).toEqual({ kind: 'duplicate', messageId: (first as { messageId: string }).messageId, pushStatus: 'sent' });
    expect(transport.calls.filter((c) => c.kind === 'push')).toHaveLength(1);
    expect(await loadMessages(id)).toHaveLength(1);
  });

  test('push ล้ม → push_failed ไม่ broadcast; retry ด้วย tempId เดิม push ใหม่สำเร็จ → duplicate pushStatus=sent', async () => {
    const id = await createConv('human_active');
    const transport = createRecordingTransport();
    const input = { conversationId: id, adminUserId: ADMIN, text: 'ลองใหม่', clientTempId: `t-${id}` };

    transport.failNextPush();
    const failed = await sendAdminReply(input, transport);
    expect(failed).toMatchObject({ kind: 'push_failed' });
    expect(broadcast).not.toHaveBeenCalled();
    expect((await loadMessages(id))[0]!.metadata).toEqual({ pushStatus: 'failed' });

    const retried = await sendAdminReply(input, transport);
    expect(retried).toEqual({ kind: 'duplicate', messageId: (failed as { messageId: string }).messageId, pushStatus: 'sent' });
    expect(transport.calls.filter((c) => c.kind === 'push')).toHaveLength(2);
    expect(await loadMessages(id)).toHaveLength(1);
  });

  test('ไม่มี clientTempId → ส่งได้ตามปกติ', async () => {
    const id = await createConv('human_active');
    const result = await sendAdminReply({ conversationId: id, adminUserId: ADMIN, text: 'ไม่มี tempId' }, createRecordingTransport());
    expect(result).toMatchObject({ kind: 'sent' });
  });

  test('ห้องที่ไม่มีอยู่ → not_found และไม่แตะ LINE', async () => {
    const transport = createRecordingTransport();
    expect(await sendAdminReply({ conversationId: generateId(), adminUserId: ADMIN, text: 'x' }, transport)).toEqual({ kind: 'not_found' });
    expect(transport.calls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่า fail**

Run: `npx vitest run src/lib/line/conversation/message-service.integration.test.ts`
Expected: FAIL — `SyntaxError: The requested module './message-service' does not provide an export named 'sendAdminReply'` (หรือ `sendAdminReply is not a function`)

- [ ] **Step 3: เขียน implementation**

ใน `src/lib/line/conversation/message-service.ts` แทนที่ import block บนสุดด้วย:

```ts
import { and, eq, sql } from 'drizzle-orm';
import { getDb, type Db } from '@/lib/db';
import { chatConversations, chatMessages } from '@/lib/db/schema';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { generateId } from '@/lib/id';
import type { ConversationMode } from '../chat-modes';
import { broadcast } from '../sse/broadcaster';
import type { LineOutgoingMessage } from '../types';
import { isHumanHandled } from './modes';
import type { LineTransport } from './transport';
```

แล้วต่อท้ายไฟล์:

```ts
export type PushStatus = 'pending' | 'sent' | 'failed';

/** ผลของ helper ที่ยิง LINE แล้วบันทึก — `pending` เป็นสถานะใน DB ก่อนส่ง ไม่ใช่ผลของ helper นี้ */
export type PushAttemptStatus = 'sent' | 'failed';

export interface AdminReplyInput {
  conversationId: string;
  adminUserId: string;
  text: string;
  /** idempotency key จาก client — retry ด้วยค่าเดิมจะไม่สร้างข้อความ/push ซ้ำ */
  clientTempId?: string;
}

export type AdminReplyResult =
  | { kind: 'not_found' }
  | { kind: 'sent'; messageId: string; pushStatus: 'sent' }
  | { kind: 'duplicate'; messageId: string | undefined; pushStatus: PushStatus | undefined }
  | { kind: 'push_failed'; messageId: string };

type ChatMessageRow = typeof chatMessages.$inferSelect;

function getPushStatus(metadata: unknown): PushStatus | undefined {
  if (metadata && typeof metadata === 'object' && 'pushStatus' in metadata) {
    return (metadata as { pushStatus?: PushStatus }).pushStatus;
  }
  return undefined;
}

async function pushAndRecord(
  db: Db,
  transport: LineTransport,
  messageId: string,
  lineUserId: string,
  text: string,
): Promise<PushAttemptStatus> {
  let status: PushAttemptStatus;
  try {
    await transport.push(lineUserId, [{ type: 'text', text }]);
    status = 'sent';
  } catch (error) {
    console.error('[admin-chat] pushMessage failed', { messageId, error });
    status = 'failed';
  }
  await db
    .update(chatMessages)
    .set({ metadata: sql`coalesce(${chatMessages.metadata}, '{}'::jsonb) || ${JSON.stringify({ pushStatus: status })}::jsonb` })
    .where(eq(chatMessages.id, messageId));
  return status;
}

function findByTempId(db: Db, conversationId: string, clientTempId: string) {
  return firstOrUndefined(
    db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.clientTempId, clientTempId)))
      .limit(1),
  );
}

// idempotent retry: เคย insert ด้วย tempId เดิมแล้ว → ไม่สร้างซ้ำ
// retry push เฉพาะเมื่อครั้งก่อน push พังจริง (pushStatus=failed)
async function retryExisting(
  db: Db,
  transport: LineTransport,
  existing: ChatMessageRow,
  lineUserId: string,
  text: string,
): Promise<AdminReplyResult> {
  const stored = getPushStatus(existing.metadata);
  if (stored === 'failed') {
    const retried = await pushAndRecord(db, transport, existing.id, lineUserId, existing.textContent ?? text);
    if (retried === 'failed') return { kind: 'push_failed', messageId: existing.id };
    return { kind: 'duplicate', messageId: existing.id, pushStatus: retried };
  }
  return { kind: 'duplicate', messageId: existing.id, pushStatus: stored };
}

/** แอดมินตอบผู้ใช้ — บันทึกก่อน push เสมอ ข้อความจึงไม่หายแม้ LINE ล่ม (client retry ด้วย tempId เดิม) */
export async function sendAdminReply(input: AdminReplyInput, transport: LineTransport): Promise<AdminReplyResult> {
  const { conversationId, adminUserId, text, clientTempId } = input;
  const db = await getDb();

  const conversation = await firstOrUndefined(
    db
      .select({ lineUserId: chatConversations.lineUserId })
      .from(chatConversations)
      .where(eq(chatConversations.id, conversationId))
      .limit(1),
  );
  if (!conversation) return { kind: 'not_found' };

  if (clientTempId) {
    const existing = await findByTempId(db, conversationId, clientTempId);
    if (existing) return retryExisting(db, transport, existing, conversation.lineUserId, text);
  }

  const messageId = generateId();
  const inserted = await db
    .insert(chatMessages)
    .values({
      id: messageId,
      conversationId,
      sender: 'admin',
      messageType: 'text',
      textContent: text,
      adminUserId,
      clientTempId: clientTempId ?? null,
      metadata: { pushStatus: 'pending' satisfies PushStatus },
    })
    .onConflictDoNothing()
    .returning({ id: chatMessages.id });

  // แพ้ race กับ retry ที่วิ่งพร้อมกัน (ชน unique client_temp_id) — อีก request เป็นผู้ส่ง
  if (inserted.length === 0 && clientTempId) {
    const winner = await findByTempId(db, conversationId, clientTempId);
    return { kind: 'duplicate', messageId: winner?.id, pushStatus: getPushStatus(winner?.metadata) };
  }

  await db
    .update(chatConversations)
    .set({ lastMessageText: text, lastMessageAt: new Date(), lastMessageSender: 'admin', unreadAdmin: 0, updatedAt: new Date() })
    .where(eq(chatConversations.id, conversationId));

  const pushed = await pushAndRecord(db, transport, messageId, conversation.lineUserId, text);
  // ข้อความอยู่ใน DB แล้ว — client retry ด้วย tempId เดิมจะเข้า path retry push ไม่สร้างซ้ำ
  if (pushed === 'failed') return { kind: 'push_failed', messageId };

  broadcast({
    type: 'new_message',
    conversationId,
    payload: { id: messageId, sender: 'admin', messageType: 'text', textContent: text, clientTempId: clientTempId ?? null, createdAt: new Date().toISOString() },
  });
  return { kind: 'sent', messageId, pushStatus: pushed };
}
```

> `sendAdminReply` ยาวราว 50 บรรทัด — ถ้า eslint/ผู้รีวิวติดเรื่องความยาว ให้แยกส่วน insert เป็น `insertAdminMessage(db, input, messageId)` ในไฟล์เดียวกัน

ใน `src/lib/line/conversation/index.ts` แก้ export ของ message-service เป็น:

```ts
export {
  recordBotReplies,
  recordInboundMessage,
  sendAdminReply,
  type AdminReplyInput,
  type AdminReplyResult,
  type InboundMessage,
  type InboundMessageType,
  type PushAttemptStatus,
  type PushStatus,
} from './message-service';
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run src/lib/line/conversation/message-service.integration.test.ts`
Expected: `Test Files  1 passed (1)`, `Tests  10 passed (10)` (log `[admin-chat] pushMessage failed` หนึ่งครั้งจากเทสต์ push ล้ม — ปกติ)

- [ ] **Step 5: Commit**

```bash
git add src/lib/line/conversation/message-service.ts src/lib/line/conversation/message-service.integration.test.ts src/lib/line/conversation/index.ts
git commit -m "feat(line): sendAdminReply — ตอบแชทแบบ idempotent ผ่าน LineTransport"
```

---

### Task 7: ย้าย `triggerHandoff` ไปใช้ `changeMode`

**Files:**
- Modify: `src/lib/line/bot/handoff.ts`
- Test: `src/lib/line/bot/handoff.test.ts`

**Interfaces:**
- Consumes: `changeMode(conversationId, 'waiting_handoff')` จาก `../conversation` (Task 4)
- Produces: `triggerHandoff` signature เดิม; broadcast มาจาก `changeMode` แทน

- [ ] **Step 1: เขียน failing test สำหรับ race (แอดมินรับห้องไปก่อน)**

ต่อท้าย `describe('triggerHandoff', …)` ใน `src/lib/line/bot/handoff.test.ts`:

```ts
  it('§ แอดมินรับห้องไปก่อน (race) → ไม่ทับ human_active และไม่ broadcast แต่ยังตอบผู้ใช้', async () => {
    dbMocks.returning.mockResolvedValueOnce([]);
    dbMocks.limit.mockResolvedValueOnce([{ mode: 'human_active', assignedAdminId: 'admin-1' }]);

    const replies = await triggerHandoff('conv-1');

    expect(broadcast).not.toHaveBeenCalled();
    expect(replies).toHaveLength(2);
  });
```

- [ ] **Step 2: รันให้เห็นว่า fail**

Run: `npx vitest run src/lib/line/bot/handoff.test.ts`
Expected: FAIL ที่เทสต์ race — `expected "spy" to not be called at all, but actually been called 1 times` (โค้ด Task 1 broadcast เสมอและไม่มี guard)

- [ ] **Step 3: เขียน implementation**

แทนที่ `src/lib/line/bot/handoff.ts` ทั้งไฟล์:

```ts
import type { LineOutgoingMessage } from '../types';
import { handoffNotifyFlex } from '../messages/flex';
import { getChatSetting } from '../settings';
import { changeMode } from '../conversation';

export async function isHandoffRequest(text: string): Promise<boolean> {
  const keywords = await getChatSetting('handoff_keywords');
  const normalized = text.toLowerCase().trim();
  return keywords.some((kw) => normalized.includes(kw.toLowerCase()));
}

export async function triggerHandoff(conversationId: string): Promise<LineOutgoingMessage[]> {
  // § ผ่าน changeMode — ได้ทั้ง guard (ไม่ทับห้องที่แอดมินรับไปแล้ว) และ broadcast mode_change
  // เดิม update ตรง ๆ โดยไม่ broadcast ทำ inbox แอดมินค้างโหมด bot_active
  // ผล conflict ไม่ต้องจัดการ: ห้องอยู่ในมือเจ้าหน้าที่แล้ว ข้อความตอบผู้ใช้ด้านล่างยังถูกต้อง
  await changeMode(conversationId, 'waiting_handoff');

  return [
    handoffNotifyFlex(),
    { type: 'text', text: 'ระบบได้แจ้งเจ้าหน้าที่แล้วครับ กรุณารอสักครู่' },
  ];
}
```

- [ ] **Step 4: รันให้ผ่าน + engine ไม่พัง**

Task นี้เป็นจุดแรกที่ `engine.test` โหลด `transport.ts` (ผ่าน barrel `../conversation` ที่ handoff import) `httpLineTransport` อ่าน `pushMessage` จาก `../client` ตอนสร้าง module — ก่อนรัน เติม `pushMessage` ใน `vi.mock('../client')` ของ `src/lib/line/bot/engine.test.ts` ให้ครบ (ของเดิมมีแค่ `getProfile` / `replyMessage` / `sendTypingIndicator`):

```ts
vi.mock('../client', () => ({
  getProfile: vi.fn(async () => null),
  replyMessage: vi.fn(async () => {}),
  pushMessage: vi.fn(async () => {}),
  sendTypingIndicator: vi.fn(async () => {}),
}));
```

ไม่มี stub นี้ เทสต์ตายที่ "ไม่มี pushMessage export ใน mock" ก่อนถึง assertion ของ handoff ขั้นนี้ยังไม่ยิง LINE: mock อยู่ที่ boundary ของ `client.ts`

Run: `npx vitest run src/lib/line/bot/handoff.test.ts src/lib/line/bot/engine.test.ts`
Expected: handoff.test ผ่านทั้งหมด; **engine.test อาจ FAIL** ที่ `handoff detection` ด้วย `TypeError: …returning is not a function` เพราะ mockDb ของ engine.test ยังไม่รองรับ `.returning()` — ถ้าเป็นแบบนั้นให้แก้ mockDb ใน `src/lib/line/bot/engine.test.ts` บรรทัด 12-16 เป็น:

```ts
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      // รองรับทั้ง `await …where()` และ `…where().returning()` (changeMode ใช้ returning)
      where: vi.fn(() =>
        Object.assign(Promise.resolve(undefined), {
          returning: vi.fn().mockResolvedValue([{ id: 'conv-1' }]),
        }),
      ),
    }),
  }),
```

แล้วรันซ้ำ — Expected: `Test Files  2 passed (2)`

- [ ] **Step 5: Commit**

```bash
git add src/lib/line/bot/handoff.ts src/lib/line/bot/handoff.test.ts src/lib/line/bot/engine.test.ts
git commit -m "refactor(line): triggerHandoff ใช้ changeMode — มี guard + broadcast จาก module เดียว"
```

---

### Task 8: ย้าย bot engine ไปใช้ module + inject `LineTransport`

**Files:**
- Modify: `src/lib/line/bot/engine.ts:1-170` (imports, `handleEvent`, `getOrCreateLineUser`, `handleMessageEvent`) และ `:280-292` (`handleFollowEvent`)
- Test: `src/lib/line/bot/engine.test.ts`

**Interfaces:**
- Consumes: `recordInboundMessage`, `recordBotReplies`, `isHumanHandled`, `httpLineTransport`, `LineTransport` จาก `../conversation`; `createRecordingTransport` (ในเทสต์)
- Produces: `handleEvent(event: LineWebhookEvent, transport?: LineTransport): Promise<void>` — default `httpLineTransport` ดังนั้น `webhook/route.ts` ไม่ต้องแก้; `routeBotMessage` signature เดิม

- [ ] **Step 1: เขียน failing test**

ใน `src/lib/line/bot/engine.test.ts`:

1. ลบ block นี้ทิ้ง (engine ไม่ import `../client` ตรงอีกต่อไป — recording transport มาแทน):

```ts
vi.mock('../client', () => ({
  getProfile: vi.fn(async () => null),
  replyMessage: vi.fn(async () => {}),
  sendTypingIndicator: vi.fn(async () => {}),
}));
```

2. แก้ imports ใต้ mocks เป็น:

```ts
import { handleEvent, routeBotMessage } from './engine';
import { matchFaq } from './faq-matcher';
import { startCaseFlow } from './case-flow';
import { broadcast } from '../sse/broadcaster';
import { createRecordingTransport } from '../conversation/recording-transport';
```

3. ต่อท้ายไฟล์:

```ts
describe('handleEvent — คุยกับ LINE ผ่าน LineTransport (recording adapter)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ข้อความทั่วไป: ดึงโปรไฟล์ผู้ใช้ใหม่ → typing → reply ผ่าน transport', async () => {
    const transport = createRecordingTransport();

    await handleEvent(makeEvent('สวัสดีครับ'), transport);

    expect(transport.calls.map((c) => c.kind)).toEqual(['profile', 'typing', 'reply']);
    const reply = transport.calls[2] as { kind: 'reply'; replyToken: string; messages: { text?: string }[] };
    expect(reply.replyToken).toBe('reply-token');
    expect(reply.messages[0]!.text).toContain('ไม่เข้าใจ');
  });

  it('§ handoff: mode_change ต้องตามหลัง conversation_update — inbox แอดมินไม่ค้าง bot_active', async () => {
    await handleEvent(makeEvent('ติดต่อเจ้าหน้าที่'), createRecordingTransport());

    const events = vi.mocked(broadcast).mock.calls.map(([e]) => e);
    expect(events.map((e) => e.type)).toEqual(['new_message', 'conversation_update', 'mode_change']);
    expect(events[2]).toEqual({ type: 'mode_change', conversationId: expect.any(String), payload: { mode: 'waiting_handoff' } });
  });
});
```

- [ ] **Step 2: รันให้เห็นว่า fail**

ก่อนรัน: ขั้น RED นี้ห้ามยิง LINE จริง แม้จะลบ `vi.mock('../client')` แล้ว engine เก่ายังเรียก `client.ts` ตรง ให้ stub ที่ boundary ของเครือข่ายก่อน import engine (วางเหนือ import ของ `./engine`):

```ts
vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
```

`afterAll` ของไฟล์เรียก `vi.unstubAllGlobals()` ไม่ต้องเพิ่ม teardown แยก stub นี้ทำให้ default `httpLineTransport` ไม่ถึง `api.line.me` RED ยังแดงที่พฤติกรรม (`transport.calls` ว่าง) ไม่ใช่ที่ network

Run: `npx vitest run src/lib/line/bot/engine.test.ts`
Expected: FAIL ที่ describe ใหม่ — `transport.calls` เป็น `[]` (engine ยังเรียก `client.ts` ตรง ไม่ผ่าน recording transport) ส่วน `routeBotMessage` tests เดิมยังผ่าน ถ้าแดงเพราะ `fetch` ไป `api.line.me` แปลว่า stub ไม่ทัน — หยุด อย่ารันซ้ำโดยไม่มี stub

- [ ] **Step 3: เขียน implementation**

ใน `src/lib/line/bot/engine.ts`:

3a. แทนที่ import block (บรรทัด 1-18) ด้วย:

```ts
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { lineUsers, chatConversations, chatMessages, cases } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import type { LineWebhookEvent, LineMessageEvent, LineFollowEvent, LinePostbackEvent, LineOutgoingMessage } from '../types';
import type { ConversationMode } from '../chat-modes';
import { matchFaq } from './faq-matcher';
import { matchIntent } from './intent-matcher';
import { parseResponseText } from './response-parser';
import { startCaseFlow, processCaseFlow, type CaseFlowState } from './case-flow';
import { isHandoffRequest, triggerHandoff } from './handoff';
import { getWelcomeMessages } from './welcome';
import { getChatSetting } from '../settings';
import { caseStatusFlex } from '../messages/flex';
import { getFaqReply } from '../messages/rich-menu';
import { normalizeTrackingCode } from '@/lib/case-tracking';
import { COPY } from '@/lib/copy';
import {
  httpLineTransport,
  isHumanHandled,
  recordBotReplies,
  recordInboundMessage,
  type LineTransport,
} from '../conversation';
```

3b. แทนที่ `handleEvent` (บรรทัด 22-43):

```ts
export async function handleEvent(event: LineWebhookEvent, transport: LineTransport = httpLineTransport) {
  const userId = event.source.userId;
  if (!userId) return;

  const db = await getDb();
  const lineUser = await getOrCreateLineUser(db, userId, transport);
  const conversation = await getOrCreateConversation(db, userId);

  switch (event.type) {
    case 'message':
      await handleMessageEvent(db, event, lineUser.id, conversation.id, conversation.mode, transport);
      break;
    case 'follow':
      await handleFollowEvent(event, conversation.id, transport);
      break;
    case 'postback':
      await handlePostbackEvent(db, event, conversation.id);
      break;
    case 'unfollow':
      break;
  }
}
```

3c. ใน `getOrCreateLineUser` เปลี่ยน signature และสองจุดที่เรียก `getProfile` (คอมเมนต์เดิมคงไว้ทั้งหมด):

```ts
async function getOrCreateLineUser(db: Db, lineUserId: string, transport: LineTransport) {
```

```ts
      const profile = await transport.getProfile(lineUserId).catch(() => null);
```

```ts
  const profile = await transport.getProfile(lineUserId).catch(() => null);
```

3d. แทนที่ `handleMessageEvent` (บรรทัด 101-170) ทั้งฟังก์ชัน:

```ts
async function handleMessageEvent(
  db: Db,
  event: LineMessageEvent,
  lineUserPk: string,
  conversationId: string,
  mode: ConversationMode,
  transport: LineTransport,
) {
  const msg = event.message;
  const textContent = msg.type === 'text' ? msg.text : null;
  const messageType = msg.type === 'text' ? 'text'
    : msg.type === 'image' ? 'image'
    : msg.type === 'location' ? 'location'
    : msg.type === 'sticker' ? 'sticker'
    : 'text';

  await recordInboundMessage({
    conversationId,
    mode,
    messageType,
    textContent,
    locationData: msg.type === 'location'
      ? { title: msg.title, address: msg.address, latitude: msg.latitude, longitude: msg.longitude }
      : null,
    lineMessageId: msg.id,
  });

  if (isHumanHandled(mode)) {
    return;
  }

  await transport.showTyping(event.source.userId);

  const replies = await routeBotMessage(db, event, textContent, lineUserPk, conversationId);

  await recordBotReplies(conversationId, replies);

  await transport.reply(event.replyToken, replies.slice(0, 5));
}
```

3e. แทนที่ `handleFollowEvent` (บรรทัด 280-292) — inject `transport` แต่คงการ insert เดิม (เฉพาะข้อความแรก) ไม่เปลี่ยนพฤติกรรมที่ผู้ใช้เห็น (`handlePostbackEvent` ห้ามแตะ):

```ts
async function handleFollowEvent(event: LineFollowEvent, conversationId: string, transport: LineTransport) {
  const replies = await getWelcomeMessages();
  const db = await getDb();

  await db.insert(chatMessages).values({
    id: generateId(),
    conversationId,
    sender: 'bot',
    messageType: 'text',
    textContent: (replies[0] as { type: 'text'; text: string }).text,
  });

  await transport.reply(event.replyToken, replies);
}
```

> `chatConversations` ยังใช้ใน `getOrCreateConversation`, `chatMessages` ยังใช้ใน follow/postback, `generateId` ยังใช้ — import ไม่ค้าง; `sql` และ `broadcast` ถูกลบเพราะไม่ใช้แล้ว

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run src/lib/line/bot`
Expected: `Test Files  4 passed (4)` (case-flow, engine, handoff, welcome) — engine.test มี `vi.mock` เหลือ 7 จาก 8

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/lib/line`
Expected: ไม่มี error

- [ ] **Step 6: Commit**

```bash
git add src/lib/line/bot/engine.ts src/lib/line/bot/engine.test.ts
git commit -m "refactor(line): bot engine บันทึกข้อความผ่าน conversation module + inject LineTransport"
```

---

### Task 9: ย้าย PATCH `/api/line/admin/conversations/[id]` ไปใช้ module

**พฤติกรรมที่ตั้งใจเปลี่ยน (ต้องแจ้งในคำอธิบาย PR):**
1. PATCH `mode` ที่ตารางไม่อนุญาต (เช่น `human_active → waiting_handoff`) ได้ 409 แทนที่จะเขียนทับ — UI ปัจจุบันไม่ส่ง transition เหล่านี้ (ดู `chat-header.tsx:79-146`)
2. PATCH เป็นโหมดเดิม (เช่น `resolved → resolved`) ตอบ 200 แต่ไม่ update/broadcast ซ้ำ (เดิม update `resolvedAt` ใหม่ + broadcast)
3. payload ของ `mode_change` เหลือ `{ mode, assignedAdminId?, linkedCaseId? }` (เดิมส่งทั้ง `updates` รวม `updatedAt`/`assignedAt`/`resolvedAt` เป็น Date) — client อ่านแค่ `mode`/`assignedAdminId`

**Files:**
- Modify: `src/app/api/line/admin/conversations/[id]/route.ts:1-14, 66-227`
- Test: `src/app/api/line/admin/conversations/[id]/route.integration.test.ts`

**Interfaces:**
- Consumes: `changeMode`, `transferOwnership`, `linkCase`, `ModeChangeResult` จาก `@/lib/line/conversation`
- Produces: `PATCH` handler (HTTP contract เดิม + ข้อ 1-3 ข้างบน)

- [ ] **Step 1: เขียน failing test**

ต่อท้าย `src/app/api/line/admin/conversations/[id]/route.integration.test.ts` (ทำงานต่อจาก state ของเทสต์ก่อนหน้า: ห้องเป็น `human_active`, เจ้าของ = adminB):

```ts
describe('PATCH — transition ผ่าน conversation module', () => {
  test('ห้าม human_active → waiting_handoff (ไม่อยู่ในตาราง) → 409 และโหมดไม่เปลี่ยน', async () => {
    mocks.currentUserId = adminBId;
    const res = await PATCH(patchRequest(conversationId, { mode: 'waiting_handoff' }), params(conversationId));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('สถานะบทสนทนาเปลี่ยนไปแล้ว กรุณารีเฟรช');
    expect((await loadConv()).mode).toBe('human_active');
  });

  test('ปิดเรื่อง human_active → resolved ตั้ง resolvedAt; ปิดซ้ำได้ 200 (idempotent)', async () => {
    const res = await PATCH(patchRequest(conversationId, { mode: 'resolved' }), params(conversationId));
    expect(res.status).toBe(200);
    const conv = await loadConv();
    expect(conv.mode).toBe('resolved');
    expect(conv.resolvedAt).toBeInstanceOf(Date);

    const again = await PATCH(patchRequest(conversationId, { mode: 'resolved' }), params(conversationId));
    expect(again.status).toBe(200);
  });

  test('claim ห้อง resolved → 409 (คืนให้บอทก่อน) แล้ว resolved → bot_active ได้', async () => {
    const claim = await PATCH(patchRequest(conversationId, { mode: 'human_active' }), params(conversationId));
    expect(claim.status).toBe(409);
    expect((await claim.json()).error).toBe('เปลี่ยนสถานะไม่ได้จากสถานะปัจจุบัน');

    const toBot = await PATCH(patchRequest(conversationId, { mode: 'bot_active' }), params(conversationId));
    expect(toBot.status).toBe(200);
    expect((await loadConv()).mode).toBe('bot_active');
  });

  test('linkedCaseId อย่างเดียว: ผูกเคสโดยไม่เปลี่ยนโหมด; 404 ห้องที่ไม่มี', async () => {
    const caseId = generateId();
    const res = await PATCH(patchRequest(conversationId, { linkedCaseId: caseId }), params(conversationId));
    expect(res.status).toBe(200);
    const conv = await loadConv();
    expect(conv.linkedCaseId).toBe(caseId);
    expect(conv.mode).toBe('bot_active');

    const missing = generateId();
    const notFound = await PATCH(patchRequest(missing, { linkedCaseId: null }), params(missing));
    expect(notFound.status).toBe(404);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่า fail**

Run: `npx vitest run "src/app/api/line/admin/conversations/[id]/route.integration.test.ts"`
Expected: FAIL เทสต์แรกของ describe ใหม่ — `expected 200 to be 409` (route เดิมไม่มี guard สำหรับ `waiting_handoff`); เทสต์เดิมทั้งหมดยังผ่าน

- [ ] **Step 3: เขียน implementation**

ใน `src/app/api/line/admin/conversations/[id]/route.ts`:

3a. แทนที่ import block (บรรทัด 1-12):

```ts
import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatMessages, chatConversations, users } from '@/lib/db/schema';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { chatPagingQuerySchema, updateConversationSchema } from '@/lib/validation';
import { parseBody } from '@/lib/api-helpers';
import { changeMode, linkCase, transferOwnership } from '@/lib/line/conversation';
```

3b. แทนที่ `PATCH` (บรรทัด 66-227) ทั้งฟังก์ชัน และเพิ่ม helper สองตัวไว้เหนือมัน:

```ts
async function isActiveStaff(userId: string): Promise<boolean> {
  const db = await getDb();
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.isActive, true), inArray(users.role, [...STAFF_ROLES])))
    .limit(1);
  return Boolean(target);
}

// ── โน้ตภายใน — autosave, ไม่ broadcast (กัน refetch ไป clobber draft ของแอดมินอื่น) ──
// ไม่ใช่การเปลี่ยนสถานะบทสนทนา จึงไม่อยู่ใน conversation module
async function saveAdminNote(id: string, adminNote: string | null, adminId: string) {
  const db = await getDb();
  const [noted] = await db
    .update(chatConversations)
    .set({ adminNote, adminNoteUpdatedAt: new Date(), adminNoteUpdatedBy: adminId, updatedAt: new Date() })
    .where(eq(chatConversations.id, id))
    .returning({ id: chatConversations.id });
  if (!noted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  // § parseBody ไม่ใช่ request.json()+validateOrError — ถ้า c8 merge ก่อน ห้าม revert กลับไป manual parse
  const parsed = await parseBody(updateConversationSchema, request);
  if (!parsed.ok) return parsed.response;

  const { mode, linkedCaseId, assignedAdminId, transferReason, adminNote } = parsed.data;
  const { id } = await params;
  const actorId = authz.ctx.user.id;

  // ── โอนแชท / รับช่วงต่อ — path แยกจาก claim (mode ต้องเป็น human_active อยู่แล้ว) ──
  if (assignedAdminId !== undefined && mode === undefined) {
    // กันโอนให้ id ผี — ปลายทางต้องเป็นเจ้าหน้าที่ที่ยัง active จริง
    if (!(await isActiveStaff(assignedAdminId))) {
      return NextResponse.json({ error: 'ปลายทางไม่ใช่เจ้าหน้าที่ที่ใช้งานอยู่' }, { status: 400 });
    }
    const result = await transferOwnership(id, { toAdminId: assignedAdminId, byAdminId: actorId, reason: transferReason });
    if (result.ok) return NextResponse.json({ ok: true });
    if (result.reason === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ error: 'โอนแชทได้เฉพาะห้องที่เจ้าหน้าที่กำลังดูแลอยู่' }, { status: 409 });
  }

  if (adminNote !== undefined && mode === undefined && linkedCaseId === undefined) {
    return saveAdminNote(id, adminNote, actorId);
  }

  if (mode === undefined) {
    // schema refine + สอง branch ข้างบนรับประกันว่าเหลือแค่ linkedCaseId
    const linked = await linkCase(id, linkedCaseId ?? null);
    if (!linked.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  // § claim/คืนบอท/ปิดเรื่อง ผ่าน changeMode — guard อยู่ใน WHERE (atomic) ตามตาราง MODE_TRANSITIONS
  // กันสองแอดมินกดรับพร้อมกันแล้วคนหลังทับเงียบ ๆ
  const result = await changeMode(id, mode, { actorAdminId: actorId, linkedCaseId });
  if (result.ok) return NextResponse.json({ ok: true });
  if (result.reason === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(
    { error: mode === 'human_active' ? 'เปลี่ยนสถานะไม่ได้จากสถานะปัจจุบัน' : 'สถานะบทสนทนาเปลี่ยนไปแล้ว กรุณารีเฟรช' },
    { status: 409 },
  );
}
```

> `GET` (บรรทัด 16-64) ไม่แตะ; `sql` ถูกลบจาก import เพราะ jsonb_set ย้ายไป `transferOwnership` แล้ว

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run "src/app/api/line/admin/conversations/[id]/route.integration.test.ts"`
Expected: `Test Files  1 passed (1)`, `Tests  13 passed (13)` — เดิม 9 (GET 3, claim 1, transfer 3, note 2) + ใหม่ 4

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint "src/app/api/line/admin/conversations"`
Expected: ไม่มี error

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/line/admin/conversations/[id]/route.ts" "src/app/api/line/admin/conversations/[id]/route.integration.test.ts"
git commit -m "refactor(line): PATCH conversation ใช้ conversation module — transition ตามตาราง + atomic guard"
```

---

### Task 10: ย้าย POST `/api/line/admin/conversations/[id]/messages` ไปใช้ `sendAdminReply`

route นี้ยังไม่มีเทสต์เลย — เขียน characterization test ก่อน (stub `fetch` ระดับ global ซึ่งใช้ได้ทั้งก่อนและหลัง migrate เพราะ `httpLineTransport` ก็ลงไปที่ `fetch` เหมือนกัน) ให้เขียวกับโค้ดเดิม แล้วค่อยย้าย

**Files:**
- Create: `src/app/api/line/admin/conversations/[id]/messages/route.integration.test.ts`
- Modify: `src/app/api/line/admin/conversations/[id]/messages/route.ts` (ทั้งไฟล์)

**Interfaces:**
- Consumes: `sendAdminReply`, `httpLineTransport` จาก `@/lib/line/conversation`
- Produces: `POST` handler — HTTP contract เดิมทุกกรณี (200 / 200 duplicate / 502 / 404 / 400)

- [ ] **Step 1: เขียน characterization test**

สร้าง `src/app/api/line/admin/conversations/[id]/messages/route.integration.test.ts`:

```ts
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { chatConversations, chatMessages } from '@/lib/db/schema';
import { generateId } from '@/lib/id';

const mocks = vi.hoisted(() => ({ currentUserId: '' }));

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaffApi: vi.fn(async () => ({
    ok: true,
    ctx: { user: { id: mocks.currentUserId }, ipAddress: '127.0.0.1', userAgent: undefined },
  })),
}));

vi.mock('@/lib/line/sse/broadcaster', () => ({ broadcast: vi.fn() }));

import { broadcast } from '@/lib/line/sse/broadcaster';
import { POST } from './route';

// stub ที่ขอบ HTTP — ใช้ได้ทั้งโค้ดเดิม (pushMessage ตรง) และหลังย้ายไป httpLineTransport
const fetchMock = vi.fn<typeof fetch>();
let conversationId: string;
let lineUserId: string;

function postRequest(id: string, body: unknown): Request {
  return new Request(`http://localhost:3000/api/line/admin/conversations/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function pushBodies(): { to: string; messages: { text: string }[] }[] {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).endsWith('/message/push'))
    .map(([, init]) => JSON.parse(String(init?.body)));
}

async function messagesByTempId(tempId: string) {
  const db = await getDb();
  return db.select().from(chatMessages).where(eq(chatMessages.clientTempId, tempId));
}

beforeAll(async () => {
  vi.stubGlobal('fetch', fetchMock);
  mocks.currentUserId = generateId();
  conversationId = generateId();
  lineUserId = `it-line-reply-${conversationId}`;
  const db = await getDb();
  await db.insert(chatConversations).values({
    id: conversationId,
    lineUserId,
    mode: 'human_active',
    assignedAdminId: mocks.currentUserId,
    unreadAdmin: 2,
  });
});

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }));
  vi.mocked(broadcast).mockClear();
});

afterAll(async () => {
  vi.unstubAllGlobals();
  const db = await getDb();
  await db.delete(chatMessages).where(eq(chatMessages.conversationId, conversationId));
  await db.delete(chatConversations).where(eq(chatConversations.id, conversationId));
  await closeDb();
});

describe('POST /api/line/admin/conversations/[id]/messages', () => {
  test('ส่งใหม่: 200 + push ไป LINE + pushStatus=sent + last message เป็น admin + broadcast', async () => {
    const tempId = `tmp-${generateId()}`;
    const res = await POST(postRequest(conversationId, { text: 'รับเรื่องแล้วครับ', clientTempId: tempId }), params(conversationId));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, pushStatus: 'sent' });
    expect(body.duplicate).toBeUndefined();
    expect(pushBodies()).toEqual([{ to: lineUserId, messages: [{ type: 'text', text: 'รับเรื่องแล้วครับ' }] }]);

    const [row] = await messagesByTempId(tempId);
    expect(row).toMatchObject({ id: body.messageId, sender: 'admin', adminUserId: mocks.currentUserId, metadata: { pushStatus: 'sent' } });

    const db = await getDb();
    const [conv] = await db.select().from(chatConversations).where(eq(chatConversations.id, conversationId));
    expect(conv).toMatchObject({ lastMessageText: 'รับเรื่องแล้วครับ', lastMessageSender: 'admin', unreadAdmin: 0 });
    expect(broadcast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'new_message', conversationId, payload: expect.objectContaining({ id: body.messageId, clientTempId: tempId }) }),
    );
  });

  test('retry tempId เดิมหลังสำเร็จ: 200 duplicate ไม่ push ซ้ำ', async () => {
    const tempId = `tmp-${generateId()}`;
    const first = await (await POST(postRequest(conversationId, { text: 'ซ้ำ', clientTempId: tempId }), params(conversationId))).json();
    fetchMock.mockClear();

    const res = await POST(postRequest(conversationId, { text: 'ซ้ำ', clientTempId: tempId }), params(conversationId));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, messageId: first.messageId, pushStatus: 'sent', duplicate: true });
    expect(pushBodies()).toHaveLength(0);
    expect(await messagesByTempId(tempId)).toHaveLength(1);
  });

  test('LINE ตอบ 500 → 502 pushStatus=failed ไม่ broadcast; retry tempId เดิมสำเร็จ → 200 duplicate', async () => {
    const tempId = `tmp-${generateId()}`;
    fetchMock.mockImplementationOnce(async () => new Response('boom', { status: 500 }));

    const failed = await POST(postRequest(conversationId, { text: 'ลองใหม่', clientTempId: tempId }), params(conversationId));
    expect(failed.status).toBe(502);
    const failedBody = await failed.json();
    expect(failedBody).toMatchObject({ error: 'ส่งข้อความไป LINE ไม่สำเร็จ', pushStatus: 'failed' });
    expect(broadcast).not.toHaveBeenCalled();

    const retried = await POST(postRequest(conversationId, { text: 'ลองใหม่', clientTempId: tempId }), params(conversationId));
    expect(retried.status).toBe(200);
    expect(await retried.json()).toEqual({ ok: true, messageId: failedBody.messageId, pushStatus: 'sent', duplicate: true });
    expect(pushBodies()).toHaveLength(2);
    expect(await messagesByTempId(tempId)).toHaveLength(1);
  });

  test('404 ห้องที่ไม่มี และไม่ยิง LINE', async () => {
    const missing = generateId();
    const res = await POST(postRequest(missing, { text: 'x' }), params(missing));
    expect(res.status).toBe(404);
    expect(pushBodies()).toHaveLength(0);
  });

  test('400 ข้อความว่าง', async () => {
    const res = await POST(postRequest(conversationId, { text: '   ' }), params(conversationId));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: รันกับโค้ดเดิม — ต้องเขียว (characterization)**

Run: `npx vitest run "src/app/api/line/admin/conversations/[id]/messages/route.integration.test.ts"`
Expected: `Test Files  1 passed (1)`, `Tests  5 passed (5)` — ถ้าแดง แปลว่าเทสต์อ่านพฤติกรรมเดิมผิด ให้แก้เทสต์ (ไม่ใช่ route) จนเขียว แล้ว commit แยก:

```bash
git add "src/app/api/line/admin/conversations/[id]/messages/route.integration.test.ts"
git commit -m "test(line): characterization test ของ POST admin reply ก่อนย้ายเข้า conversation module"
```

- [ ] **Step 3: ย้าย route ไปใช้ module**

แทนที่ `src/app/api/line/admin/conversations/[id]/messages/route.ts` ทั้งไฟล์:

```ts
import { NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { chatReplySchema } from '@/lib/validation';
import { parseBody } from '@/lib/api-helpers';
import { httpLineTransport, sendAdminReply } from '@/lib/line/conversation';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  // § parseBody ไม่ใช่ request.json()+validateOrError — ถ้า c8 merge ก่อน ห้าม revert กลับไป manual parse
  const parsed = await parseBody(chatReplySchema, request);
  if (!parsed.ok) return parsed.response;

  const { text, clientTempId } = parsed.data;
  const { id } = await params;

  const result = await sendAdminReply(
    { conversationId: id, adminUserId: authz.ctx.user.id, text, clientTempId },
    httpLineTransport,
  );

  switch (result.kind) {
    case 'not_found':
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    case 'push_failed':
      // ข้อความอยู่ใน DB แล้ว — client retry ด้วย tempId เดิมจะเข้า path retry push ไม่สร้างซ้ำ
      return NextResponse.json(
        { error: 'ส่งข้อความไป LINE ไม่สำเร็จ', messageId: result.messageId, pushStatus: 'failed' },
        { status: 502 },
      );
    case 'duplicate':
      return NextResponse.json({ ok: true, messageId: result.messageId, pushStatus: result.pushStatus, duplicate: true });
    case 'sent':
      return NextResponse.json({ ok: true, messageId: result.messageId, pushStatus: result.pushStatus });
  }
}
```

- [ ] **Step 4: รันเทสต์เดิมซ้ำ — ต้องยังเขียว**

Run: `npx vitest run "src/app/api/line/admin/conversations/[id]/messages/route.integration.test.ts"`
Expected: `Test Files  1 passed (1)`, `Tests  5 passed (5)`

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint "src/app/api/line/admin/conversations"`
Expected: ไม่มี error (`switch` ครอบคลุมทุก `kind` — TS ไม่เตือน missing return)

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/line/admin/conversations/[id]/messages/route.ts"
git commit -m "refactor(line): POST admin reply ใช้ sendAdminReply ผ่าน httpLineTransport"
```

---

### Task 11: Gate รวม, รีเฟรช graft, เปิด PR

**Files:** ไม่มีไฟล์ใหม่ (graft index อัปเดตอัตโนมัติ)

- [ ] **Step 1: รีเฟรช graft ก่อน แล้วค่อยยืนยันว่าไม่มีใครเขียน `chatConversations.mode` นอก module**

`graft grep` อ่าน index ไม่ใช่ไฟล์สด — รัน `graft build` ก่อนเสมอ ไม่งั้น hit เก่าที่ลบไปแล้วจะโผล่

Run: `graft build` แล้ว `graft grep "mode: 'waiting_handoff'"` และ `graft grep "broadcast({ type: 'mode_change'"`
Expected: ทุก hit อยู่ใน `src/lib/line/conversation/` หรือไฟล์เทสต์เท่านั้น

- [ ] **Step 2: Gate เต็มชุด**

```bash
docker compose up -d postgres redis up-redis
npx tsc --noEmit
npx eslint src/lib/line src/app/api/line/admin/conversations
npx vitest run
```

Expected: `tsc` ไม่มี error; `eslint` เฉพาะไฟล์ที่แผนนี้แตะต้อง 0 error (ห้ามอ้าง `npx eslint .` exit 0 — baseline ของ repo มี 21 errors / 3 warnings ที่ไม่เกี่ยวกับแผนนี้ และห้ามแก้ในงานนี้); vitest `Test Files  N passed (N)` ไม่มี failed (รวม `tokens.contrast.test.ts` และ integration ทั้งหมด)

- [ ] **Step 3: Smoke test ด้วยมือ (ไม่มี E2E ครอบ inbox SSE)**

```bash
npx next dev
```

เปิด `http://localhost:3000/admin/chat` สองแท็บ (login เจ้าหน้าที่) → แท็บ A กด "เจ้าหน้าที่" ในห้องหนึ่ง → แท็บ B ต้องเห็น banner เจ้าของห้องทันที; กด "ปิดเรื่อง" แล้ว "คืนให้ Bot" → ทั้งสองแท็บอัปเดตโหมดตรงกัน
(ถ้ามี LINE OA ทดสอบ: พิมพ์ "ติดต่อเจ้าหน้าที่" → inbox ต้องเปลี่ยนเป็นรอเจ้าหน้าที่ทันทีโดยไม่ต้องรีเฟรช)

- [ ] **Step 4: ยืนยัน graft index จาก Step 1**

`graft build` รันไปแล้วใน Step 1 (ต้องอยู่ก่อน `graft grep`) ตรวจว่า node ใหม่สำหรับ `src/lib/line/conversation/*` อยู่ใน index ถ้า Step 1 ไม่ได้รัน ให้รัน `graft build` ตรงนี้ก่อนถือว่า gate ผ่าน

- [ ] **Step 5: Push + PR**

```bash
git push -u origin refactor/conversation-module
gh pr create --title "refactor(line): conversation module — โหมดสนทนา + บันทึกข้อความ + LineTransport port" --body "$(cat <<'EOF'
## สรุป
- แก้บั๊ก: handoff เปลี่ยนเป็น waiting_handoff แต่ไม่ broadcast mode_change → inbox แอดมินค้าง bot_active
- เพิ่ม `src/lib/line/conversation/` — ตารางเปลี่ยนโหมด pure + `changeMode`/`transferOwnership`/`linkCase` (atomic guard + broadcast) และ `recordInboundMessage`/`recordBotReplies`/`sendAdminReply`
- port `LineTransport` สอง adapter: `httpLineTransport` (prod) และ `createRecordingTransport()` (เทสต์)
- ย้าย engine, handoff, PATCH conversation, POST messages มาใช้ module

## พฤติกรรมที่เปลี่ยนโดยตั้งใจ
1. PATCH mode ที่ตารางไม่อนุญาต (เช่น human_active → waiting_handoff) ได้ 409 — UI ปัจจุบันไม่ส่ง transition เหล่านี้
2. PATCH เป็นโหมดเดิมตอบ 200 แต่ไม่ update/broadcast ซ้ำ
3. payload ของ mode_change เหลือ `{ mode, assignedAdminId?, linkedCaseId? }`

## Test plan
- [ ] `npx tsc --noEmit` / `npx eslint` เฉพาะไฟล์ที่แตะ (0 error; ไม่ใช่ `npx eslint .` ทั้ง repo) / `npx vitest run` (Docker stack เปิด)
- [ ] Smoke: claim / ปิดเรื่อง / คืนบอท สองแท็บ sync กัน
- [ ] Smoke: LINE "ติดต่อเจ้าหน้าที่" → inbox เปลี่ยนเป็นรอเจ้าหน้าที่ทันที
- [ ] Vercel preview OK

หมายเหตุ: GitHub Actions ถูกพักไว้ — ไม่มี CI run เป็นเรื่องปกติ

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: URL ของ PR

---

## Self-Review

**1. Spec coverage (การ์ด c4 + คำสั่งงาน):**
- (a) งานแรก = regression test + แก้บั๊ก handoff broadcast → Task 1; ยืนยันลำดับ event ระดับ engine (`new_message → conversation_update → mode_change`) → Task 8
- (b) module เจ้าของ mode transitions (ตาราง pure + guard) และการบันทึกข้อความ + broadcast → Task 2, 4, 5, 6
- (c) port `LineTransport` สอง adapter, ฉีดเข้า module → Task 3; ใช้จริงใน Task 6 (`sendAdminReply`), Task 8 (`handleEvent`), Task 10 (route ส่ง `httpLineTransport`)
- (d) ย้ายทีละ task: handoff (7), engine (8), PATCH (9), messages (10); integration test conversations เดิม (`[id]/route.integration.test.ts`) คงไว้และรันใน Task 0, 9, 11; `prefs/route.integration.test.ts` ไม่ถูกแตะแต่รันใน gate Task 11
- SSE contract: payload `mode_change` = `{ mode, assignedAdminId?, linkedCaseId? }` ตรงกับ `SseChatEvent` ที่ `chat-client.tsx:83-97` อ่าน; ไม่เพิ่ม event type ใหม่

**2. Placeholder scan:** ไม่มี TBD/TODO/"similar to"; ทุก step ที่แก้โค้ดมีโค้ดเต็ม; Task 6 มีหมายเหตุทางเลือกแยกฟังก์ชันถ้าเกิน 50 บรรทัด พร้อมชื่อฟังก์ชันที่ชัดเจน

**3. Type consistency:**
- `ModeChangeResult` (`{ ok: true; changed }` | `not_found` | `conflict + currentMode`) ใช้ตรงกันใน Task 4 เทสต์, Task 7 (ไม่อ่านผล), Task 9 route
- `LineTransport` methods `reply/push/showTyping/getProfile` ตรงกันใน Task 3, 6, 8; `TransportCall.kind` = `'reply' | 'push' | 'typing' | 'profile'` ตรงกับ assertion ใน Task 3, 6, 8
- `AdminReplyResult.kind` = `'not_found' | 'sent' | 'duplicate' | 'push_failed'` ตรงกันใน Task 6 และ Task 10; `kind:'sent'` ได้ `pushStatus:'sent'` จาก `PushAttemptStatus` ของ `pushAndRecord` เท่านั้น (`pending` อยู่ใน DB ก่อนส่ง ไม่ถูก assign เข้า result — ไม่มี type assertion)
- `recordInboundMessage(InboundMessage)` field `mode: ConversationMode` — engine Task 8 ส่ง `conversation.mode` (pgEnum typed) และเปลี่ยน param `mode: string` เดิมเป็น `ConversationMode`
- `allowedSourceModes('human_active')` = `['bot_active', 'waiting_handoff']` ตามลำดับ `CONVERSATION_MODES` — ตรงกับ assertion Task 2 และ claim guard เดิม
