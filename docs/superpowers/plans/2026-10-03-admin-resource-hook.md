# Admin Resource Hook (client adapter + useResource) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** รวม state + effect + fetch + notify ที่ 9 หน้า admin เขียนเองซ้ำ ๆ ให้อยู่ใน adapter module เดียว (parse error envelope ที่เดียว) + hook เดียว (โหลด / แก้แล้วโหลดใหม่ / แจ้งผล + timer / ทิ้ง response ช้า) จนปิด ESLint `react-hooks/set-state-in-effect` ทั้ง 6 จุดได้โดยไม่ต้อง `eslint-disable`

**Architecture:** (a) `src/app/admin/_lib/admin-api.ts` — client adapter สำหรับ `/api/line/admin/*` แปลง `{error}` envelope เป็น `ApiResult<T> = {ok:true,data} | {ok:false,error,status}` ที่เดียว และรวม type ของทุก endpoint ไว้ในไฟล์เดียว (แต่ละหน้าจะไม่ `fetch` เองอีก) (b) `src/app/admin/_lib/use-resource.ts` — hook เดียวที่เป็นเจ้าของการโหลด (debounce ค้นหา, poll ทุก N ms, stale-response guard ด้วย sequence ref), การ `mutate` แล้วแจ้งผลแล้วโหลดใหม่, และ feedback ที่มี timer เคลียร์ถูกต้อง ทั้งคู่ test ด้วย seam จริง: test ของ hook ใช้ in-memory adapter แทน `fetch` แล้ว migrate หน้าจอทีละ task

**Tech Stack:** Next.js 16 App Router, React 19.2.7, TypeScript strict, ESLint 9 flat config + eslint-plugin-react-hooks 7.1.1 (rule `react-hooks/set-state-in-effect`), Vitest 3 + @testing-library/react 16.3.2 (jsdom 26)

**Spec:** `project-log-md/architecture-review/2026-10-03/architecture-review-20261003-205746.html` — การ์ด `id="c3"` ("หน้า admin ฝั่ง chatbot: โหลด–แก้–แจ้งผล ผ่าน module เดียว")

## Global Constraints

- ใช้ `npx` แทน `pnpm` ทุกคำสั่ง (`pnpm` ค้างใน environment นี้ — เหตุผลอยู่ใน `AGENTS.md`)
- ทำงานบน branch `refactor/admin-resource-hook` เท่านั้น (Task 0 สร้างจาก `main`)
- ข้อความ UI, error ที่ผู้ใช้เห็น, และ comment ในโค้ดเป็นภาษาไทย; comment ที่อธิบายการตัดสินใจไม่ชัดเจนขึ้นต้นด้วย `§`; **ห้ามลบ `§` comment เดิม** ในไฟล์ที่ย้าย (เช่น `SEND_WINDOW_MINUTES` ของ broadcast)
- ห้ามใช้ `eslint-disable react-hooks/set-state-in-effect` (หรือ disable ใด ๆ) เพื่อผ่าน gate — ต้องผ่านด้วยรูปโค้ดที่ถูกต้อง; `§` ใน `use-resource.ts` อธิบายว่าทำไม effect ต้องเป็น `setTimeout` + async IIFE
- ห้ามเพิ่ม dependency ใหม่ — `@testing-library/react`, `vitest`, `jsdom` มีใน `package.json` แล้ว
- ห้ามแก้ server route (`src/app/api/line/admin/**`), ห้ามแก้ contract ของ `src/app/admin/chat/_lib/api.ts`, ห้ามแก้ e2e spec
- error ที่ **ไม่เกี่ยวข้อง** ต้องคงไว้ตามเดิม ห้ามแก้/ห้ามเพิ่ม: `react/no-unescaped-entities` (auto-replies ×2, reply-objects ×2, rich-menus ×2), `jsx-a11y/control-has-associated-label` (auto-replies, broadcast, reply-objects, files, settings), `@next/next/no-img-element` (files 1 warning)
- baseline วันนี้: `npx eslint .` = **24 problems (21 errors, 3 warnings)**; เป้าหมายหลัง plan = **18 problems (15 errors, 3 warnings)** และ `react-hooks/set-state-in-effect` เหลือ **0** (6 จุด: auto-replies-client.tsx:71, broadcast-client.tsx:70, reply-objects-client.tsx:64, rich-menus-client.tsx:69, files-client.tsx:52, health-client.tsx:38)
- test ที่ต้องใช้ DOM ต้องมีบรรทัดแรก `// @vitest-environment jsdom` (default ของ `vitest.config.ts` คือ `node` — ดูแบบอย่าง `src/app/admin/chat/_hooks/use-messages.test.ts`)
- ฟังก์ชัน < 50 บรรทัด, ไฟล์ < 800 บรรทัด
- ทุก task จบด้วย `npx eslint <ไฟล์ที่แก้>` + `npx tsc --noEmit` ก่อน commit; commit แบบ conventional commits (`feat(admin): …`, `refactor(admin): …`, `test(admin): …`)
- GitHub Actions ปิดอยู่โดยตั้งใจ — gate จริงคือ local (`tsc`, `eslint`, `vitest`) + Vercel Preview
- **final gate ไม่ใช่ `npx eslint .` exit 0 ทั้ง repo** — baseline นอกแผนคือ 21 errors / 3 warnings; แผนนี้ลดได้เฉพาะ 6 จุด `react-hooks/set-state-in-effect` ที่ตั้งใจแก้ → คาด **18 problems (15 errors, 3 warnings)** และ **ไม่เพิ่ม error นอก 6 จุดนั้น** (Task 12) ห้ามแก้ error ที่ไม่เกี่ยวเพื่อไล่ exit 0 และห้ามประกาศ merge-after-green จาก lint ทั้ง repo
- **ชนกับ plan `bot-config-module` (c5) ที่ `src/app/admin/settings/settings-client.tsx`:** c5 ลบ `DAY_LABELS` แล้วใช้ `import { BUSINESS_DAY_LABELS as DAY_LABELS } from '@/lib/line/business-hours'` และเพิ่ม type `business_hours` ที่เข้มขึ้น งานนี้แทน import block ทั้งก้อน (`:3`) + interface (`:9-15`) — **ต้องคง `BUSINESS_DAY_LABELS` (alias `DAY_LABELS`) และ type `business_hours` ที่ c5 เพิ่ม** ห้าม revert กลับเป็น array local หรือ type เดิม ทำ settings-client หลัง c5 หรือ rebase แล้วอ่านไฟล์จริงก่อน Task 9

---

## File Structure

| ไฟล์ | การเปลี่ยนแปลง | ความรับผิดชอบ |
|---|---|---|
| `src/app/admin/_lib/admin-api.ts` | Create | client adapter ของ `/api/line/admin/*`: `ApiResult<T>`, `request()` parse `{error}` ที่เดียว, type ของทุก resource, ฟังก์ชันต่อ endpoint (module-level → reference คงที่) |
| `src/app/admin/_lib/admin-api.test.ts` | Create | ทดสอบ envelope parsing + query string ด้วย `vi.stubGlobal('fetch')` |
| `src/app/admin/_lib/use-resource.ts` | Create | hook `useResource<TData>({ load, query, debounceMs, intervalMs, loadingOnReload })` → `{ data, loading, feedback, notify, clearFeedback, reload, mutate, setData }` |
| `src/app/admin/_lib/use-resource.test.ts` | Create | ทดสอบ hook ด้วย `renderHook` + in-memory fake adapter + fake timers (jsdom) รวม generation/unmount ของ manual reload |
| `src/app/admin/health/health-client.test.tsx` | Create | หน้า health แสดงข้อความ error จาก server (initial + reload) |
| `src/app/admin/chatbot/chatbot-dashboard-client.test.tsx` | Create | dashboard แสดงข้อความ error จาก server ไม่ใช่ข้อความทั่วไปอย่างเดียว |
| `src/app/admin/chat/_hooks/use-conversations.test.tsx` | Create | inbox แสดงข้อความ error จาก server และ reload ไม่ยก loading |
| `src/app/admin/settings/settings-client.test.tsx` | Create | settings โหลดครั้งแรกล้มต้องเห็น error ไม่ใช่หน้าว่าง |
| `src/app/admin/chatbot/auto-replies/auto-replies-client.tsx` | Modify `:3`, `:16-25`, `:37-145` | ย้าย `FaqItem` ไป adapter, ใช้ hook, แก้ double-fetch + stale search |
| `src/app/admin/chatbot/reply-objects/reply-objects-client.tsx` | Modify `:3`, `:16-24`, `:36-130` | ย้าย type + ใช้ hook |
| `src/app/admin/chatbot/rich-menus/rich-menus-client.tsx` | Modify `:3`, `:16-25`, `:40-125` | ย้าย type + ใช้ hook |
| `src/app/admin/chatbot/broadcast/broadcast-client.tsx` | Modify `:3`, `:16-26`, `:42-113` | ย้าย type + ใช้ hook (คง `§ SEND_WINDOW_MINUTES`) |
| `src/app/admin/files/files-client.tsx` | Modify `:3`, `:8-16`, `:24-92` | ย้าย type + ใช้ hook |
| `src/app/admin/health/health-client.tsx` | Modify `:3`, `:8-19`, `:21-51` | ใช้ hook + `intervalMs: 30_000` + `loadingOnReload: false` + แสดง `feedback.msg` |
| `src/app/admin/settings/settings-client.tsx` | Modify `:3`, `:9-15`, `:19-74` | ใช้ hook + derive `keywordsText` + banner error ก่อน `if (!data)` |
| `src/app/admin/chatbot/chatbot-dashboard-client.tsx` | Modify `:3`, `:7-13`, `:27-37` | ใช้ hook, เอา `catch(() => {})` ออก, แสดง `feedback.msg` |
| `src/app/admin/chat/_hooks/use-conversations.ts` | Modify `:1-42` | ใช้ hook + `loadingOnReload: false` + คืน `feedback` + ลบ `eslint-disable` |

ไม่มี migration, ไม่แก้ schema, ไม่แก้ route — งานทั้งหมดอยู่ฝั่ง client

---

### Task 0: เตรียม branch

**Files:** ไม่มี

**Interfaces:**
- Consumes: ไม่มี
- Produces: branch `refactor/admin-resource-hook` แตกจาก `main` ล่าสุด (Task 1-12 commit ลง branch นี้)

- [ ] **Step 1: สร้าง branch จาก main ล่าสุด**

Run: `git checkout main && git pull && git checkout -b refactor/admin-resource-hook`

Expected: `Switched to a new branch 'refactor/admin-resource-hook'` (ไฟล์ค้างใน working tree ที่ไม่เกี่ยวข้อง `.gitignore`, `AGENTS.md`, `next-env.d.ts` และ untracked `.claude/`, `.gemini/`, `GEMINI.md` ฯลฯ ข้ามได้ ห้าม `git add` ไฟล์เหล่านี้)

- [ ] **Step 2: บันทึก baseline ของ lint ไว้เทียบใน Task 12**

Run (PowerShell — shell ของเครื่องนี้): `npx eslint . 2>&1 | Select-Object -Last 1`

เทียบเท่า bash: `npx eslint . 2>&1 | tail -1`

Expected: `✖ 24 problems (21 errors, 3 warnings)` — ถ้าไม่ตรง ให้จดค่าที่เห็นเป็น baseline ใหม่แล้วใช้ค่านั้นแทนใน Task 12

- [ ] **Step 3: ไม่ต้อง commit (ยังไม่มีไฟล์เปลี่ยน)**

---

### Task 1: client adapter ของ /api/line/admin/*

**Files:**
- Create: `src/app/admin/_lib/admin-api.test.ts`
- Create: `src/app/admin/_lib/admin-api.ts`

**Interfaces:**
- Consumes: ไม่มี (เขียนเองทั้งหมด; endpoint contract ตรวจจาก `src/app/api/line/admin/**/route.ts` แล้ว)
- Produces (Task 2-11 ใช้):
  - `type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number }`
  - `interface ListOf<T> { items: T[] }`
  - `adminApi.listFaq(query?: string): Promise<ApiResult<FaqPage>>` — `FaqPage = ListOf<FaqItem> & { total: number }`
  - `adminApi.createFaq(payload: FaqPayload)` / `adminApi.updateFaq(id, payload)` / `adminApi.deleteFaq(id)` → `Promise<ApiResult<OkBody>>`
  - `adminApi.listReplyObjects()` / `createReplyObject(ReplyObjectInput)` / `updateReplyObject(id, ReplyObjectPatch)` / `deleteReplyObject(id)`
  - `adminApi.listRichMenus()` / `createRichMenu(RichMenuInput)` / `syncRichMenu(id)` / `publishRichMenu(id)`
  - `adminApi.listBroadcasts()` / `createBroadcast(BroadcastInput)` / `sendBroadcast(id)`
  - `adminApi.listMedia()` → `Promise<ApiResult<MediaPage>>` (`MediaPage = ListOf<MediaItem> & { storageConfigured: boolean }`) / `uploadMedia(file, category?)` / `deleteMedia(id)`
  - `adminApi.getHealth()` → `HealthData`, `adminApi.getSettings()` → `SettingsData`, `adminApi.saveSettings(SettingsInput)`, `adminApi.getChatbotStats()` → `ChatbotStats`
  - type ทั้งหมด: `FaqItem`, `FaqPayload`, `FaqPage`, `ReplyObject`, `ReplyObjectInput`, `ReplyObjectPatch`, `RichMenuItem`, `RichMenuInput`, `BroadcastItem`, `BroadcastInput`, `MediaItem`, `MediaPage`, `HealthProbe`, `HealthData`, `SettingsData`, `SettingsInput`, `ChatbotStats`
  - `interface OkBody { ok: boolean }`

- [ ] **Step 1: เขียน failing test ก่อน (RED)**

สร้าง `src/app/admin/_lib/admin-api.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from './admin-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('adminApi — error envelope ถูก parse ที่เดียว', () => {
  it('200 + { items, total } → ok:true พร้อม query string ของคำค้น', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [{ id: 'f1' }], total: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await adminApi.listFaq('เปิด');

    expect(res).toEqual({ ok: true, data: { items: [{ id: 'f1' }], total: 1 } });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/api/line/admin/faq?');
    expect(url).toContain('limit=50');
    expect(url).toContain('q=%E0%B9%80%E0%B8%9B%E0%B8%B4%E0%B8%94');
  });

  it('ดึงข้อความไทยจาก { error } ของ server พร้อม status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'ไม่พบ FAQ' }, 404)));
    const res = await adminApi.deleteFaq('f1');
    expect(res).toEqual({ ok: false, error: 'ไม่พบ FAQ', status: 404 });
  });

  it('ใช้ข้อความ fallback ภาษาไทยเมื่อ response ไม่มี { error }', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));
    const res = await adminApi.getHealth();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่');
  });

  it('fetch reject → คืน error สายเชื่อมต่อ ไม่ throw ออกจาก adapter', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    const res = await adminApi.getSettings();
    expect(res).toEqual({ ok: false, error: 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ', status: 0 });
  });

  it('DELETE ไม่แนบ body และไม่ตั้ง Content-Type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await adminApi.deleteFaq('f1');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
    expect(init.headers).toBeUndefined();
  });
});
```

- [ ] **Step 2: รัน test ให้ fail (RED)**

Run: `npx vitest run src/app/admin/_lib/admin-api.test.ts`

Expected: FAIL — `Cannot find module './admin-api'` หรือ `Failed to resolve import "./admin-api"` (exit ≠ 0)

- [ ] **Step 3: เขียน adapter (GREEN)**

สร้าง `src/app/admin/_lib/admin-api.ts`:

```ts
/**
 * client adapter ของ /api/line/admin/* — parse error envelope ที่เดียว
 *
 * § ก่อนรวม: 7 ไฟล์หน้าจอ fetch + parse `{ error }` เองซ้ำ 11 ครั้ง และ handler DELETE
 *   บางจุด `throw new Error()` เฉย ๆ จนข้อความไทยจาก server (เช่น 409 ของ reply-objects
 *   ที่บอกว่าถูกอ้างอยู่กี่ที่) หายไปจากผู้ใช้ — ดู architecture-review card c3
 * § endpoint คืนรูปไม่ตรงกัน: GET รายการคืน `{ items, total? }` ส่วน settings/health/stats
 *   คืน object เปล่า และ error คืน `{ error }` + status จึงห้าม assume ว่าทุกจุดคืนรูปเดียว
 */

export type ApiOk<T> = { ok: true; data: T };
export type ApiFail = { ok: false; error: string; status: number };
export type ApiResult<T> = ApiOk<T> | ApiFail;

export interface OkBody {
  ok: boolean;
}

export interface ListOf<T> {
  items: T[];
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  priority: number;
  isActive: boolean;
  hitCount: number;
  createdAt: string;
}

export interface FaqPayload {
  question: string;
  answer: string;
  keywords: string[];
  priority: number;
  isActive: boolean;
}

export interface FaqPage extends ListOf<FaqItem> {
  total: number;
}

export interface ReplyObject {
  id: string;
  objectId: string;
  objectType: string;
  payload: Record<string, unknown>;
  altText: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ReplyObjectInput {
  objectId: string;
  objectType: string;
  payload: Record<string, unknown>;
  altText?: string; // create schema รับ string optional เท่านั้น — ไม่รับ null (route.ts createSchema)
  isActive: boolean;
}

export interface ReplyObjectPatch {
  objectType: string;
  payload: Record<string, unknown>;
  altText?: string | null; // update schema รับ null ได้ (route.ts updateSchema)
  isActive: boolean;
}

export interface RichMenuItem {
  id: string;
  name: string;
  chatBarText: string;
  lineRichMenuId: string | null;
  status: string;
  syncStatus: string;
  lastSyncError: string | null;
  createdAt: string;
}

export interface RichMenuInput {
  name: string;
  chatBarText: string;
  config: unknown;
}

export interface BroadcastItem {
  id: string;
  content: { type: string; text?: string }[];
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  totalRecipients: number;
  successCount: number;
  failedCount: number;
  createdAt: string;
}

export interface BroadcastInput {
  content: { type: string; text?: string }[];
  scheduledAt: string | null;
}

export interface MediaItem {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  createdAt: string;
}

export interface MediaPage extends ListOf<MediaItem> {
  storageConfigured: boolean;
}

export interface HealthProbe {
  name: string;
  status: 'ok' | 'error';
  latencyMs: number;
  detail?: string;
}

export interface HealthData {
  status: string;
  probes: HealthProbe[];
  timestamp: string;
}

export interface SettingsData {
  welcome_message: string;
  handoff_keywords: string[];
  business_hours: { start: string; end: string; days: number[] };
  bot_enabled: boolean;
  line: { configured: boolean; maskedToken: string | null };
}

export type SettingsInput = Omit<SettingsData, 'line'>;

export interface ChatbotStats {
  messages: { totalIn: number; totalOut: number };
  faq: { total: number; active: number; hits: number; hitRate: number };
  conversations: { total: number; active: number; handoff: number };
  topFaq: { question: string; hitCount: number }[];
}

interface UploadResult extends OkBody {
  id: string;
  url: string;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

function withBody(method: string, body: unknown): RequestInit {
  return { method, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

function fallbackError(status: number): string {
  if (status === 401 || status === 403) return 'สิทธิ์ไม่เพียงพอ';
  if (status === 404) return 'ไม่พบข้อมูลที่ระบุ';
  if (status === 409) return 'ข้อมูลซ้ำกับรายการเดิม';
  if (status >= 500) return 'เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่';
  return 'ทำรายการไม่สำเร็จ';
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    return { ok: false, error: 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ', status: 0 };
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const envelope = (body as { error?: unknown } | null)?.error;
    return {
      ok: false,
      error:
        typeof envelope === 'string' && envelope.length > 0 ? envelope : fallbackError(res.status),
      status: res.status,
    };
  }
  return { ok: true, data: body as T };
}

export const adminApi = {
  // ── FAQ / ตอบอัตโนมัติ ──
  listFaq: (query = ''): Promise<ApiResult<FaqPage>> => {
    const params = new URLSearchParams({ limit: '50' });
    if (query) params.set('q', query);
    return request<FaqPage>(`/api/line/admin/faq?${params}`);
  },
  createFaq: (payload: FaqPayload): Promise<ApiResult<OkBody>> =>
    request<OkBody>('/api/line/admin/faq', withBody('POST', payload)),
  updateFaq: (id: string, payload: FaqPayload): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/faq/${id}`, withBody('PATCH', payload)),
  deleteFaq: (id: string): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/faq/${id}`, { method: 'DELETE' }),

  // ── Reply objects ──
  listReplyObjects: (): Promise<ApiResult<ListOf<ReplyObject>>> =>
    request<ListOf<ReplyObject>>('/api/line/admin/reply-objects'),
  createReplyObject: (payload: ReplyObjectInput): Promise<ApiResult<OkBody>> =>
    request<OkBody>('/api/line/admin/reply-objects', withBody('POST', payload)),
  updateReplyObject: (id: string, payload: ReplyObjectPatch): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/reply-objects/${id}`, withBody('PATCH', payload)),
  deleteReplyObject: (id: string): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/reply-objects/${id}`, { method: 'DELETE' }),

  // ── Rich menus ──
  listRichMenus: (): Promise<ApiResult<ListOf<RichMenuItem>>> =>
    request<ListOf<RichMenuItem>>('/api/line/admin/rich-menus'),
  createRichMenu: (payload: RichMenuInput): Promise<ApiResult<OkBody>> =>
    request<OkBody>('/api/line/admin/rich-menus', withBody('POST', payload)),
  syncRichMenu: (id: string): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/rich-menus/${id}/sync`, { method: 'POST' }),
  publishRichMenu: (id: string): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/rich-menus/${id}/publish`, { method: 'POST' }),

  // ── Broadcasts ──
  listBroadcasts: (): Promise<ApiResult<ListOf<BroadcastItem>>> =>
    request<ListOf<BroadcastItem>>('/api/line/admin/broadcasts'),
  createBroadcast: (payload: BroadcastInput): Promise<ApiResult<OkBody>> =>
    request<OkBody>('/api/line/admin/broadcasts', withBody('POST', payload)),
  sendBroadcast: (id: string): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/broadcasts/${id}/send`, { method: 'POST' }),

  // ── Media ──
  listMedia: (): Promise<ApiResult<MediaPage>> => request<MediaPage>('/api/line/admin/media'),
  uploadMedia: (file: File, category = 'general'): Promise<ApiResult<UploadResult>> => {
    const form = new FormData();
    form.append('file', file);
    form.append('category', category);
    return request<UploadResult>('/api/line/admin/media', { method: 'POST', body: form });
  },
  deleteMedia: (id: string): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/media/${id}`, { method: 'DELETE' }),

  // ── health / settings / stats ──
  getHealth: (): Promise<ApiResult<HealthData>> => request<HealthData>('/api/line/admin/health'),
  getSettings: (): Promise<ApiResult<SettingsData>> =>
    request<SettingsData>('/api/line/admin/settings'),
  saveSettings: (payload: SettingsInput): Promise<ApiResult<OkBody>> =>
    request<OkBody>('/api/line/admin/settings', withBody('PUT', payload)),
  getChatbotStats: (): Promise<ApiResult<ChatbotStats>> =>
    request<ChatbotStats>('/api/line/admin/chatbot-stats'),
};
```

- [ ] **Step 4: รัน test ให้ผ่าน (GREEN)**

Run: `npx vitest run src/app/admin/_lib/admin-api.test.ts`

Expected:

```
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

- [ ] **Step 5: gate lint + typecheck**

Run: `npx eslint src/app/admin/_lib && npx tsc --noEmit`

Expected: ไม่มี output ทั้งสองคำสั่ง (exit 0)

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/_lib/admin-api.ts src/app/admin/_lib/admin-api.test.ts
git commit -m "feat(admin): เพิ่ม client adapter รวม /api/line/admin/* + parse error envelope ที่เดียว"
```

Expected: `[refactor/admin-resource-hook <sha>] feat(admin): …` และ `2 files changed`

---

### Task 2: hook useResource (โหลด / แก้แล้วโหลดใหม่ / แจ้งผล / ทิ้ง response ช้า)

**Files:**
- Create: `src/app/admin/_lib/use-resource.test.ts`
- Create: `src/app/admin/_lib/use-resource.ts`

**Interfaces:**
- Consumes: `ApiResult<T>` จาก `src/app/admin/_lib/admin-api.ts` (Task 1)
- Produces (Task 3-11 ใช้):

```ts
export type Feedback = { type: 'success' | 'error'; msg: string } | null;

export interface UseResourceOptions<TData> {
  load: (query: string) => Promise<ApiResult<TData>>; // ส่งฟังก์ชันคงที่จาก module (adminApi.xxx)
  query?: string;                                      // เปลี่ยน → โหลดใหม่หลัง debounce
  debounceMs?: number;                                 // default 0
  intervalMs?: number;                                 // poll ทุก N ms (หน้า health)
  loadingOnReload?: boolean;                           // default true
}

export interface UseResourceResult<TData> {
  data: TData | null;
  loading: boolean;
  feedback: Feedback;
  notify: (type: 'success' | 'error', msg: string) => void;
  clearFeedback: () => void;
  reload: () => Promise<void>;
  mutate: <TResult>(
    fn: () => Promise<ApiResult<TResult>>,
    successMsg: string,
    mutateOpts?: { reload?: boolean },
  ) => Promise<boolean>;
  setData: (updater: (prev: TData | null) => TData | null) => void;
}

export function useResource<TData>(options: UseResourceOptions<TData>): UseResourceResult<TData>;
```

- [ ] **Step 1: เขียน failing test ก่อน (RED)**

สร้าง `src/app/admin/_lib/use-resource.test.ts`:

```ts
// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiResult } from './admin-api';
import { useResource } from './use-resource';

interface Row {
  id: string;
  name: string;
}
interface Page {
  items: Row[];
  total: number;
}

/** in-memory adapter — seam ที่สองของ hook (ของจริงคือ adminApi ที่ยิง fetch) */
function makeAdapter(seed: Page) {
  const state = { page: seed };
  let manual = false;
  const resolvers: Array<(r: ApiResult<Page>) => void> = [];
  const load = vi.fn((query: string): Promise<ApiResult<Page>> => {
    if (!manual) return Promise.resolve({ ok: true, data: state.page });
    return new Promise((resolve) => {
      resolvers.push(resolve);
    });
  });
  return {
    load,
    state,
    useManual() {
      manual = true;
    },
    resolveAt(index: number, result: ApiResult<Page>) {
      resolvers[index]!(result);
    },
  };
}

async function flush(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useResource', () => {
  it('โหลดครั้งเดียวตอน mount แล้วหยุดสถานะโหลด (ไม่ยิง fetch ซ้ำ)', async () => {
    const adapter = makeAdapter({ items: [{ id: '1', name: 'a' }], total: 1 });
    const { result } = renderHook(() => useResource({ load: adapter.load }));

    await flush(0);

    expect(adapter.load).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.data?.total).toBe(1);
  });

  it('ค้นหากันสะบัด 300ms — mount โหลดทันที แต่พิมพ์แล้วรอครบเวลา', async () => {
    const adapter = makeAdapter({ items: [], total: 0 });
    const { rerender } = renderHook(
      ({ q }: { q: string }) => useResource({ load: adapter.load, query: q, debounceMs: 300 }),
      { initialProps: { q: '' } },
    );
    await flush(0);
    expect(adapter.load).toHaveBeenCalledTimes(1);
    expect(adapter.load).toHaveBeenLastCalledWith('');

    rerender({ q: 'ว' });
    await flush(299);
    expect(adapter.load).toHaveBeenCalledTimes(1);

    await flush(1);
    expect(adapter.load).toHaveBeenCalledTimes(2);
    expect(adapter.load).toHaveBeenLastCalledWith('ว');
  });

  it('ทิ้ง response ของ request เก่าที่มาช้ากว่า', async () => {
    const adapter = makeAdapter({ items: [{ id: '0', name: 'seed' }], total: 1 });
    adapter.useManual();
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useResource({ load: adapter.load, query: q, debounceMs: 300 }),
      { initialProps: { q: '' } },
    );
    await flush(0); // call #0 ยังค้าง
    rerender({ q: 'ใหม่' });
    await flush(300); // call #1 ยังค้าง
    expect(adapter.load).toHaveBeenCalledTimes(2);

    await act(async () => {
      adapter.resolveAt(1, { ok: true, data: { items: [{ id: '2', name: 'ใหม่' }], total: 1 } });
    });
    expect(result.current.data?.items[0]?.id).toBe('2');

    // response ของ request เก่ามาช้า → ต้องไม่แทนที่ค่าใหม่
    await act(async () => {
      adapter.resolveAt(0, { ok: true, data: { items: [{ id: '1', name: 'เก่า' }], total: 1 } });
    });
    expect(result.current.data?.items[0]?.id).toBe('2');
  });

  it('mutate สำเร็จ: แจ้งผล + โหลดใหม่อัตโนมัติ + ข้อความหายใน 4s', async () => {
    const adapter = makeAdapter({ items: [], total: 0 });
    const { result } = renderHook(() => useResource({ load: adapter.load }));
    await flush(0);

    let ok = false;
    await act(async () => {
      ok = await result.current.mutate(
        async () => ({ ok: true as const, data: { ok: true } }),
        'บันทึกสำเร็จ',
      );
    });

    expect(ok).toBe(true);
    expect(result.current.feedback).toEqual({ type: 'success', msg: 'บันทึกสำเร็จ' });
    expect(adapter.load).toHaveBeenCalledTimes(2); // reload หลัง mutate
    expect(result.current.loading).toBe(false);

    await flush(4000);
    expect(result.current.feedback).toBeNull();
  });

  it('mutate ล้มเหลว: แจ้ง error จาก envelope และไม่โหลดใหม่ (และ opts.reload:false ใช้ได้)', async () => {
    const adapter = makeAdapter({ items: [], total: 0 });
    const { result } = renderHook(() => useResource({ load: adapter.load }));
    await flush(0);

    let ok = true;
    await act(async () => {
      ok = await result.current.mutate(
        async () => ({ ok: false as const, error: 'ไม่พบ FAQ', status: 404 }),
        'ไม่ควรขึ้น',
      );
    });

    expect(ok).toBe(false);
    expect(result.current.feedback).toEqual({ type: 'error', msg: 'ไม่พบ FAQ' });
    expect(adapter.load).toHaveBeenCalledTimes(1); // ไม่ reload

    await act(async () => {
      await result.current.mutate(
        async () => ({ ok: true as const, data: { ok: true } }),
        'อีกครั้ง',
        { reload: false },
      );
    });
    expect(adapter.load).toHaveBeenCalledTimes(1); // reload:false ไม่ยิงเพิ่ม
  });

  it('notify ซ้ำ: timer ของข้อความเก่าถูกเคลียร์ ข้อความใหม่ไม่โดนลบเร็ว', async () => {
    const adapter = makeAdapter({ items: [], total: 0 });
    const { result } = renderHook(() => useResource({ load: adapter.load }));
    await flush(0);

    act(() => result.current.notify('success', 'แรก'));
    await flush(3000);
    act(() => result.current.notify('error', 'สอง'));
    await flush(2000); // เกิน 4000ms ของ "แรก" แล้ว
    expect(result.current.feedback).toEqual({ type: 'error', msg: 'สอง' });

    await flush(2001); // ครบ 4000ms ของ "สอง"
    expect(result.current.feedback).toBeNull();
  });

  it('intervalMs: โหลดซ้ำทุก 30s โดย loadingOnReload:false ไม่ปิดข้อมูลเดิม', async () => {
    const adapter = makeAdapter({ items: [{ id: '1', name: 'a' }], total: 1 });
    const { result } = renderHook(() =>
      useResource({ load: adapter.load, intervalMs: 30_000, loadingOnReload: false }),
    );
    await flush(0);
    expect(adapter.load).toHaveBeenCalledTimes(1);

    await flush(30_000);
    expect(adapter.load).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(false);
    expect(result.current.data?.items).toHaveLength(1);
  });

  it('โหลดล้มเหลว: แจ้งผล error ตาม envelope และหยุดสถานะโหลด', async () => {
    const load = vi.fn(
      async (): Promise<ApiResult<Page>> => ({ ok: false, error: 'สิทธิ์ไม่เพียงพอ', status: 403 }),
    );
    const { result } = renderHook(() => useResource({ load }));
    await flush(0);

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.feedback).toEqual({ type: 'error', msg: 'สิทธิ์ไม่เพียงพอ' });
  });

  it('reload ค้างแล้ว query เปลี่ยน: ผลของ query เก่าไม่ทับข้อมูลใหม่', async () => {
    const adapter = makeAdapter({ items: [{ id: '0', name: 'seed' }], total: 1 });
    adapter.useManual();
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useResource({ load: adapter.load, query: q, debounceMs: 300 }),
      { initialProps: { q: 'A' } },
    );
    await flush(0);
    await act(async () => {
      void result.current.reload(); // reload(A) ค้าง — ยังไม่ resolve
    });
    rerender({ q: 'B' });
    await flush(100); // ก่อน debounce 300ms ของ B
    expect(adapter.load).toHaveBeenLastCalledWith('A');

    await flush(200); // ครบ debounce → request B
    await act(async () => {
      adapter.resolveAt(2, { ok: true, data: { items: [{ id: 'B', name: 'ใหม่' }], total: 1 } });
    });
    expect(result.current.data?.items[0]?.id).toBe('B');

    await act(async () => {
      adapter.resolveAt(1, { ok: true, data: { items: [{ id: 'A', name: 'เก่า' }], total: 1 } });
    });
    expect(result.current.data?.items[0]?.id).toBe('B'); // ผล A มาทีหลังต้องไม่ทับ
  });

  it('response ของ reload หลัง unmount ไม่ notify และไม่ตั้ง timer', async () => {
    const adapter = makeAdapter({ items: [], total: 0 });
    adapter.useManual();
    const { result, unmount } = renderHook(() => useResource({ load: adapter.load }));
    await flush(0);
    await act(async () => {
      adapter.resolveAt(0, { ok: true, data: { items: [], total: 0 } });
    });

    await act(async () => {
      void result.current.reload();
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);

    await act(async () => {
      adapter.resolveAt(1, { ok: false, error: 'มาสาย', status: 500 });
    });
    expect(vi.getTimerCount()).toBe(0); // ไม่มี notify timer หลังถอด component
  });

  it('unmount แล้วไม่มี timer แจ้งผลค้าง (ไม่มี setState หลังถอด component)', async () => {
    const adapter = makeAdapter({ items: [], total: 0 });
    const { result, unmount } = renderHook(() => useResource({ load: adapter.load }));
    await flush(0);

    act(() => result.current.notify('success', 'บันทึกแล้ว'));
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('setData แก้ค่าฝั่ง client ได้ (optimistic) และ reload ดันค่าจริงกลับมา', async () => {
    const adapter = makeAdapter({ items: [{ id: '1', name: 'เดิม' }], total: 1 });
    const { result } = renderHook(() => useResource({ load: adapter.load }));
    await flush(0);

    act(() =>
      result.current.setData((prev) =>
        prev ? { ...prev, items: [{ id: '1', name: 'optimistic' }] } : prev,
      ),
    );
    expect(result.current.data?.items[0]?.name).toBe('optimistic');

    adapter.state.page = { items: [{ id: '1', name: 'จากเซิร์ฟเวอร์' }], total: 1 };
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.data?.items[0]?.name).toBe('จากเซิร์ฟเวอร์');
  });
});
```

- [ ] **Step 2: รัน test ให้ fail (RED)**

Run: `npx vitest run src/app/admin/_lib/use-resource.test.ts`

Expected: FAIL — `Cannot find module './use-resource'` หรือ `Failed to resolve import "./use-resource"` (exit ≠ 0)

- [ ] **Step 3: เขียน hook (GREEN)**

สร้าง `src/app/admin/_lib/use-resource.ts`:

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiResult } from './admin-api';

/**
 * hook เดียวของหน้า admin: โหลดตอนเปิด/ค้นหา, mutate แล้วโหลดใหม่,
 * ข้อความแจ้งผล + timer, และทิ้ง response ที่มาช้า — ดู architecture-review card c3
 *
 * § ทำไม effect ต้องเป็น setTimeout + async IIFE ข้างใน: rule
 *   react-hooks/set-state-in-effect (eslint-plugin-react-hooks 7) ขึ้น error ทันที
 *   ถ้าเรียก function ที่มี setState (เช่น useCallback loader) ตรง ๆ จาก effect —
 *   แม้ setState จะอยู่หลัง await ก็ตาม (พิสูจน์แล้วด้วย `npx eslint --stdin`)
 *   จึงวาง setState ไว้ใน callback ของ timer/promise เท่านั้น ห้ามมี setState
 *   แบบ synchronous ใน body ของ effect
 * § loadingOnReload:false ใช้กับหน้า health ที่ poll อยู่ — กัน card กระพริบเป็น
 *   "กำลังตรวจสอบ..." ทุก 30 วินาที (พฤติกรรมเดิมของ health-client)
 */

export type Feedback = { type: 'success' | 'error'; msg: string } | null;

const FEEDBACK_MS = 4000;

export interface UseResourceOptions<TData> {
  /** ส่งฟังก์ชันคงที่จาก module (adminApi.xxx) — ห้ามสร้าง arrow inline ถ้าอยากให้ reload ตาม query ใหม่ */
  load: (query: string) => Promise<ApiResult<TData>>;
  query?: string;
  debounceMs?: number;
  intervalMs?: number;
  loadingOnReload?: boolean;
}

export interface UseResourceResult<TData> {
  data: TData | null;
  loading: boolean;
  feedback: Feedback;
  notify: (type: 'success' | 'error', msg: string) => void;
  clearFeedback: () => void;
  reload: () => Promise<void>;
  mutate: <TResult>(
    fn: () => Promise<ApiResult<TResult>>,
    successMsg: string,
    mutateOpts?: { reload?: boolean },
  ) => Promise<boolean>;
  setData: (updater: (prev: TData | null) => TData | null) => void;
}

export function useResource<TData>(options: UseResourceOptions<TData>): UseResourceResult<TData> {
  const {
    load,
    query = '',
    debounceMs = 0,
    intervalMs,
    loadingOnReload = true,
  } = options;

  const [data, setDataState] = useState<TData | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const seqRef = useRef(0); // เก็บลำดับ request ล่าสุด — response เก่าที่มาช้าคนละ seq จะถูกทิ้ง
  const mountedRef = useRef(true); // false หลัง unmount — กัน notify/setState จาก reload ที่ค้าง
  const firstRef = useRef(true); // mount ต้องโหลดทันที ไม่รอ debounce
  const notifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadRef = useRef(load);

  // ให้ handler/reload เรียก load ล่าสุดเสมอ โดยไม่ทำให้ effect รันซ้ำ
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const clearFeedback = useCallback(() => {
    if (notifyTimerRef.current !== null) {
      clearTimeout(notifyTimerRef.current);
      notifyTimerRef.current = null;
    }
    setFeedback(null);
  }, []);

  const notify = useCallback((type: 'success' | 'error', msg: string) => {
    // เคลียร์ timer เก่าก่อนเสมอ — ไม่งั้นข้อความใหม่จะโดน timer ของข้อความเก่าลบ
    if (notifyTimerRef.current !== null) clearTimeout(notifyTimerRef.current);
    setFeedback({ type, msg });
    notifyTimerRef.current = setTimeout(() => {
      notifyTimerRef.current = null;
      setFeedback(null);
    }, FEEDBACK_MS);
  }, []);

  // ปลด timer แจ้งผลตอน unmount + ยกเลิก seq ของ reload ที่ค้าง (manual reload ไม่ได้อยู่ใน effect)
  useEffect(
    () => () => {
      mountedRef.current = false;
      seqRef.current += 1;
      if (notifyTimerRef.current !== null) clearTimeout(notifyTimerRef.current);
    },
    [],
  );

  const reload = useCallback(async () => {
    const seq = ++seqRef.current;
    if (loadingOnReload) setLoading(true);
    const res = await loadRef.current(query);
    // § generation + mounted: effect cleanup ตั้ง cancelled เฉพาะ run ของ effect
    // manual reload ที่ค้างต้องถูกทิ้งด้วย seq เดียวกัน และห้าม notify/ตั้ง timer หลัง unmount
    if (!mountedRef.current || seq !== seqRef.current) return;
    if (res.ok) setDataState(res.data);
    else notify('error', res.error);
    setLoading(false);
  }, [query, loadingOnReload, notify]);

  const mutate = useCallback(
    async <TResult,>(
      fn: () => Promise<ApiResult<TResult>>,
      successMsg: string,
      mutateOpts?: { reload?: boolean },
    ): Promise<boolean> => {
      const res = await fn();
      if (!res.ok) {
        notify('error', res.error);
        return false;
      }
      notify('success', successMsg);
      if (mutateOpts?.reload !== false) await reload();
      return true;
    },
    [notify, reload],
  );

  const setData = useCallback((updater: (prev: TData | null) => TData | null) => {
    setDataState((prev) => updater(prev));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (loadingOnReload) setLoading(true);
      const seq = ++seqRef.current;
      void (async () => {
        const res = await loadRef.current(query);
        if (!mountedRef.current || cancelled || seq !== seqRef.current) return;
        if (res.ok) setDataState(res.data);
        else notify('error', res.error);
        setLoading(false);
      })();
    };
    // mount โหลดทันที (delay 0) — ไม่งั้นหน้า list จะค้าง 300ms ตอนเปิด
    const delay = firstRef.current ? 0 : debounceMs;
    firstRef.current = false;
    const timer = setTimeout(run, delay);
    const poll = intervalMs ? setInterval(run, intervalMs) : null;
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (poll !== null) clearInterval(poll);
    };
  }, [query, debounceMs, intervalMs, loadingOnReload, notify]);

  return { data, loading, feedback, notify, clearFeedback, reload, mutate, setData };
}
```

- [ ] **Step 4: รัน test ให้ผ่าน (GREEN)**

Run: `npx vitest run src/app/admin/_lib/use-resource.test.ts`

Expected:

```
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

- [ ] **Step 5: ยืนยันว่า hook ไม่โดน rule set-state-in-effect**

Run: `npx eslint src/app/admin/_lib`

Expected: ไม่มี output (exit 0) — **ห้าม** มี `react-hooks/set-state-in-effect` และห้ามมี `eslint-disable` ในไฟล์

- [ ] **Step 6: typecheck + รัน unit test ชุดอื่นไม่ให้พัง**

Run: `npx tsc --noEmit`

Expected: ไม่มี output (exit 0)

Run: `npx vitest run --exclude '**/*.integration.test.ts'`

Expected: `Test Files  … passed` ทุกไฟล์, `Tests  … passed` — ไม่มี failed (test ที่มีอยู่เดิม เช่น `use-messages.test.ts`, `use-note-autosave.test.ts`, `tokens.contrast.test.ts` ต้องผ่านเหมือนเดิม)

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/_lib/use-resource.ts src/app/admin/_lib/use-resource.test.ts
git commit -m "feat(admin): เพิ่ม hook useResource — โหลด/แก้แล้วโหลดใหม่/แจ้งผล/timer/กัน response ช้า"
```

Expected: `[refactor/admin-resource-hook <sha>] feat(admin): …` และ `2 files changed`

---

### Task 3: migrate auto-replies-client.tsx (แก้ double-fetch + stale search + DELETE ที่ทิ้ง error)

**Files:**
- Modify: `src/app/admin/chatbot/auto-replies/auto-replies-client.tsx:3` (import), `:16-25` (ลบ `interface FaqItem`), `:37-145` (state + fetch + handlers)

**Interfaces:**
- Consumes: `adminApi` + type `FaqItem`/`FaqPage` (Task 1), `useResource` (Task 2)
- Produces: ไม่มี (หน้าจอนี้ไม่ export อะไรใหม่)

**ข้อบกพร่องที่ task นี้ปิด:** โหลดซ้ำ 2 ครั้งตอน mount (effect mount + effect debounce ยิงพร้อมกัน), ไม่มี guard กัน response ช้าตอนพิมพ์ค้นหา, `handleDelete` โยน `new Error()` เปล่าจนข้อความไทยจาก server หาย, `notify` ตั้ง `setTimeout` ไม่เคยล้าง

- [ ] **Step 1: อ่านไฟล์เดิมทั้งหมดก่อนแก้**

Run: `npx eslint src/app/admin/chatbot/auto-replies/auto-replies-client.tsx`

Expected (baseline ของไฟล์นี้): 4 errors — `react-hooks/set-state-in-effect` ที่ `71:5`, `react/no-unescaped-entities` ×2 ที่ `190:31` และ `190:41`, `jsx-a11y/control-has-associated-label` ที่ `321:17`

- [ ] **Step 2: เปลี่ยน import (บรรทัด 3)**

เดิม:

```tsx
import { useCallback, useEffect, useState } from 'react';
```

ใหม่:

```tsx
import { useState } from 'react';
import type { FaqItem } from '@/app/admin/_lib/admin-api';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
```

แล้ว **ลบ** `interface FaqItem { ... }` (เดิม `:16-25`) ออกทั้งก้อน — type ย้ายไปอยู่ใน adapter แล้ว `interface FaqForm` และ `EMPTY_FORM` คงเดิม

- [ ] **Step 3: แทน state + `fetchItems` + ทั้งสอง effect + handlers (เดิม `:37-145`)**

โค้ดใหม่ (คงชื่อ `items`, `total`, `loading`, `feedback`, `notify`, `saving`, `form`, `dialogOpen`, `editingId`, `search` ไว้เหมือนเดิม → JSX ทั้งหมดใช้ได้โดยไม่ต้องแก้):

```tsx
export function AutoRepliesClient() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FaqForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const { data, loading, feedback, notify, mutate } = useResource({
    load: adminApi.listFaq,
    query: search,
    debounceMs: 300,
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(item: FaqItem) {
    setEditingId(item.id);
    setForm({
      question: item.question,
      answer: item.answer,
      keywords: item.keywords.join(', '),
      priority: item.priority,
      isActive: item.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.question.trim() || !form.answer.trim()) {
      notify('error', 'กรุณากรอกคำถามและคำตอบ');
      return;
    }
    const payload = {
      question: form.question.trim(),
      answer: form.answer.trim(),
      keywords: form.keywords.split(',').map((k) => k.trim()).filter(Boolean),
      priority: form.priority,
      isActive: form.isActive,
    };
    setSaving(true);
    const ok = await mutate(
      () => (editingId ? adminApi.updateFaq(editingId, payload) : adminApi.createFaq(payload)),
      editingId ? 'แก้ไข FAQ สำเร็จ' : 'เพิ่ม FAQ สำเร็จ',
    );
    setSaving(false);
    if (ok) setDialogOpen(false);
  }

  async function handleDelete(item: FaqItem) {
    if (!confirm(`ปิดใช้งาน "${item.question}" ?`)) return;
    // server คืน { error } ภาษาไทย (เช่น ไม่พบ FAQ) — mutate จะเอามาแจ้งให้เห็นตรง ๆ
    await mutate(() => adminApi.deleteFaq(item.id), 'ปิดใช้งาน FAQ แล้ว');
  }
```

สิ่งที่หายไปจากรายการนี้: `useState` ของ `items/total/loading/feedback`, `notify` ที่ตั้ง `setTimeout` ไม่ล้าง, `fetchItems`, `useEffect` mount (`:70-72`), `useEffect` debounce (`:74-77`), และการ `fetch` ใน `handleSave`/`handleDelete` — JSX ตั้งแต่ `return (` ลงไป **ไม่แก้เลย**

- [ ] **Step 4: gate lint ของไฟล์**

Run: `npx eslint src/app/admin/chatbot/auto-replies/auto-replies-client.tsx`

Expected: เหลือ **3 errors เท่านั้น** — `react/no-unescaped-entities` ×2 (บรรทัดข้อความ `ยังไม่มี FAQ — กด "เพิ่ม FAQ"...`) และ `jsx-a11y/control-has-associated-label` ×1 (checkbox สถานะ) — **ไม่มี** `react-hooks/set-state-in-effect` และไม่มี error ใหม่เพิ่ม

- [ ] **Step 5: typecheck**

Run: `npx tsc --noEmit`

Expected: ไม่มี output (exit 0) — ถ้าขึ้น `Cannot find name 'FaqItem'` แปลว่า Step 2 ไม่ได้เพิ่ม `import type`

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/chatbot/auto-replies/auto-replies-client.tsx
git commit -m "refactor(admin): ให้ auto-replies โหลด/ค้น/แจ้งผลผ่าน useResource — แก้โหลดซ้ำตอน mount และกัน response ช้า"
```

Expected: `[refactor/admin-resource-hook <sha>] refactor(admin): …` และ `1 file changed`

---

### Task 4: migrate reply-objects-client.tsx

**Files:**
- Modify: `src/app/admin/chatbot/reply-objects/reply-objects-client.tsx:3`, `:16-24` (ลบ `interface ReplyObject`), `:36-130`

**Interfaces:**
- Consumes: `adminApi.listReplyObjects` / `createReplyObject` / `updateReplyObject` / `deleteReplyObject`, type `ReplyObject`, `useResource` (Task 1-2)
- Produces: ไม่มี

- [ ] **Step 1: อ่านไฟล์เดิมทั้งหมดก่อนแก้**

Run: `npx eslint src/app/admin/chatbot/reply-objects/reply-objects-client.tsx`

Expected (baseline): 4 errors — `react-hooks/set-state-in-effect` `64:21`, `react/no-unescaped-entities` ×2 `151:84`/`151:90`, `jsx-a11y/control-has-associated-label` `235:15`

- [ ] **Step 2: เปลี่ยน import + ลบ type ที่ย้ายไป adapter**

เดิม:

```tsx
import { useCallback, useEffect, useState } from 'react';
```

ใหม่:

```tsx
import { useState } from 'react';
import type { ReplyObject } from '@/app/admin/_lib/admin-api';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
```

ลบ `interface ReplyObject { ... }` (`:16-24`) ทั้งก้อน; `interface FormState` + `EMPTY_FORM` คงเดิม

- [ ] **Step 3: แทน state + `fetchItems` + effect + handlers (เดิม `:36-130`)**

```tsx
export function ReplyObjectsClient() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const { data, loading, feedback, notify, mutate } = useResource({
    load: adminApi.listReplyObjects,
  });
  const items = data?.items ?? [];

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(item: ReplyObject) {
    setEditingId(item.id);
    setForm({
      objectId: item.objectId,
      objectType: item.objectType,
      payloadJson: JSON.stringify(item.payload, null, 2),
      altText: item.altText ?? '',
      isActive: item.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.objectId.trim()) {
      notify('error', 'กรุณากรอก Object ID');
      return;
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(form.payloadJson);
    } catch {
      notify('error', 'Payload JSON ไม่ถูกต้อง');
      return;
    }

    // § POST createSchema รับ altText?: string เท่านั้น (null → 400); PATCH updateSchema รับ null ได้
    const createBody = {
      objectId: form.objectId.trim(),
      objectType: form.objectType,
      payload,
      isActive: form.isActive,
      ...(form.altText ? { altText: form.altText } : {}),
    };
    const updateBody = {
      objectType: form.objectType,
      payload,
      altText: form.altText || null,
      isActive: form.isActive,
    };
    setSaving(true);
    const ok = await mutate(
      () =>
        editingId
          ? adminApi.updateReplyObject(editingId, updateBody)
          : adminApi.createReplyObject(createBody),
      editingId ? 'แก้ไขสำเร็จ' : 'สร้างสำเร็จ',
    );
    setSaving(false);
    if (ok) setDialogOpen(false);
  }

  async function handleDelete(item: ReplyObject) {
    if (!confirm(`ลบ "$${item.objectId}" ?`)) return;
    // server คืน 409 { error: 'ไม่สามารถลบได้ — ถูกอ้างอยู่ใน N ที่ …' } — ต้องโชว์ให้เห็น
    await mutate(() => adminApi.deleteReplyObject(item.id), 'ลบสำเร็จ');
  }
```

JSX ตั้งแต่ `return (` ลงไป **ไม่แก้เลย**

- [ ] **Step 4: gate lint ของไฟล์**

Run: `npx eslint src/app/admin/chatbot/reply-objects/reply-objects-client.tsx`

Expected: เหลือ **3 errors** — `react/no-unescaped-entities` ×2 และ `jsx-a11y/control-has-associated-label` ×1 — ไม่มี `react-hooks/set-state-in-effect` และไม่มี error ใหม่

- [ ] **Step 5: typecheck**

Run: `npx tsc --noEmit`

Expected: ไม่มี output (exit 0)

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/chatbot/reply-objects/reply-objects-client.tsx
git commit -m "refactor(admin): ให้ reply-objects โหลด/แจ้งผลผ่าน useResource — โชว์ error 409 ตอนลบได้"
```

Expected: `[refactor/admin-resource-hook <sha>] refactor(admin): …` และ `1 file changed`

---

### Task 5: migrate rich-menus-client.tsx

**Files:**
- Modify: `src/app/admin/chatbot/rich-menus/rich-menus-client.tsx:3`, `:16-25` (ลบ `interface RichMenuItem`), `:40-125`

**Interfaces:**
- Consumes: `adminApi.listRichMenus` / `createRichMenu` / `syncRichMenu` / `publishRichMenu`, type `RichMenuItem`, `useResource`
- Produces: ไม่มี

- [ ] **Step 1: อ่านไฟล์เดิมทั้งหมดก่อนแก้**

Run: `npx eslint src/app/admin/chatbot/rich-menus/rich-menus-client.tsx`

Expected (baseline): 3 errors — `react-hooks/set-state-in-effect` `69:21`, `react/no-unescaped-entities` ×2 ที่ `146:81`/`146:87` (ไม่มี `jsx-a11y` error ในไฟล์นี้)

- [ ] **Step 2: เปลี่ยน import + ลบ type**

เดิม:

```tsx
import { useCallback, useEffect, useState } from 'react';
```

ใหม่:

```tsx
import { useState } from 'react';
import type { RichMenuItem } from '@/app/admin/_lib/admin-api';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
```

ลบ `interface RichMenuItem { ... }` (`:16-25`) ทั้งก้อน; `DEFAULT_CONFIG` (มี `§`? ไม่มี — คง `DEFAULT_CONFIG` ไว้ตามเดิม)

- [ ] **Step 3: แทน state + `fetchItems` + effect + handlers (เดิม `:40-125`)**

```tsx
export function RichMenusClient() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [chatBarText, setChatBarText] = useState('เมนูหลัก');
  const [configJson, setConfigJson] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);

  const { data, loading, feedback, notify, mutate } = useResource({
    load: adminApi.listRichMenus,
  });
  const items = data?.items ?? [];

  async function handleCreate() {
    if (!name.trim()) {
      notify('error', 'กรุณากรอกชื่อ');
      return;
    }
    let config: unknown;
    try {
      config = JSON.parse(configJson);
    } catch {
      notify('error', 'Config JSON ไม่ถูกต้อง');
      return;
    }

    setSaving(true);
    const ok = await mutate(
      () => adminApi.createRichMenu({ name: name.trim(), chatBarText, config }),
      'สร้าง Rich Menu สำเร็จ',
    );
    setSaving(false);
    if (ok) {
      setDialogOpen(false);
      setName('');
    }
  }

  async function handleSync(item: RichMenuItem) {
    await mutate(() => adminApi.syncRichMenu(item.id), 'Sync สำเร็จ');
  }

  async function handlePublish(item: RichMenuItem) {
    if (!confirm(`Publish "${item.name}" ให้ผู้ใช้ LINE ทุกคน?`)) return;
    // server คืน 422 { error } เมื่อ LINE ปฏิเสธ — mutate เอาข้อความนั้นมาแจ้ง
    await mutate(() => adminApi.publishRichMenu(item.id), 'Publish สำเร็จ — ผู้ใช้ทุกคนจะเห็นเมนูใหม่');
  }
```

JSX ตั้งแต่ `return (` ลงไป **ไม่แก้เลย**

- [ ] **Step 4: gate lint ของไฟล์**

Run: `npx eslint src/app/admin/chatbot/rich-menus/rich-menus-client.tsx`

Expected: เหลือ **2 errors** — `react/no-unescaped-entities` ×2 เท่านั้น — ไม่มี `react-hooks/set-state-in-effect` และไม่มี error ใหม่

- [ ] **Step 5: typecheck**

Run: `npx tsc --noEmit`

Expected: ไม่มี output (exit 0)

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/chatbot/rich-menus/rich-menus-client.tsx
git commit -m "refactor(admin): ให้ rich-menus โหลด/ซิงก์/เผยแพร่ผ่าน useResource"
```

Expected: `[refactor/admin-resource-hook <sha>] refactor(admin): …` และ `1 file changed`

---

### Task 6: migrate broadcast-client.tsx

**Files:**
- Modify: `src/app/admin/chatbot/broadcast/broadcast-client.tsx:3`, `:16-26` (ลบ `interface BroadcastItem`), `:42-113`

**Interfaces:**
- Consumes: `adminApi.listBroadcasts` / `createBroadcast` / `sendBroadcast`, type `BroadcastItem`, `useResource`
- Produces: ไม่มี

**ข้อควรระวัง:** คง `§ SEND_WINDOW_MINUTES` comment (`:28-32`) และค่า `SEND_WINDOW_MINUTES` ไว้ครบ — เป็น `§` comment ที่ห้ามลบ

- [ ] **Step 1: อ่านไฟล์เดิมทั้งหมดก่อนแก้**

Run: `npx eslint src/app/admin/chatbot/broadcast/broadcast-client.tsx`

Expected (baseline): 2 errors — `react-hooks/set-state-in-effect` `70:21`, `jsx-a11y/control-has-associated-label` `176:15`

- [ ] **Step 2: เปลี่ยน import + ลบ type**

เดิม:

```tsx
import { useCallback, useEffect, useState } from 'react';
```

ใหม่:

```tsx
import { useState } from 'react';
import type { BroadcastItem } from '@/app/admin/_lib/admin-api';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
```

ลบ `interface BroadcastItem { ... }` (`:16-26`) ทั้งก้อน — **คง** `§ SEND_WINDOW_MINUTES` และ `STATUS_MAP` ไว้เดิมทุกบรรทัด

- [ ] **Step 3: แทน state + `fetchItems` + effect + handlers (เดิม `:42-113`)**

```tsx
export function BroadcastClient() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, loading, feedback, notify, mutate } = useResource({
    load: adminApi.listBroadcasts,
  });
  const items = data?.items ?? [];

  async function handleCreate() {
    if (!message.trim()) {
      notify('error', 'กรุณากรอกข้อความ');
      return;
    }
    setSaving(true);
    const ok = await mutate(
      () =>
        adminApi.createBroadcast({
          content: [{ type: 'text', text: message.trim() }],
          scheduledAt: scheduleAt || null,
        }),
      scheduleAt ? 'ตั้งเวลาส่งแล้ว' : 'สร้างร่างสำเร็จ',
    );
    setSaving(false);
    if (ok) {
      setDialogOpen(false);
      setMessage('');
      setScheduleAt('');
    }
  }

  async function handleSend(item: BroadcastItem) {
    if (!confirm('ส่งประกาศหาผู้ติดตามทุกคนทันที?')) return;
    // server คืน 409 { error: 'ส่งแล้วหรือกำลังส่ง' } / 404 — mutate โชว์ข้อความนั้น
    await mutate(() => adminApi.sendBroadcast(item.id), 'ส่งประกาศสำเร็จ');
  }
```

JSX ตั้งแต่ `return (` ลงไป **ไม่แก้เลย** (รวม `SEND_WINDOW_MINUTES` ที่ใช้ใน `FieldHint`)

- [ ] **Step 4: gate lint ของไฟล์**

Run: `npx eslint src/app/admin/chatbot/broadcast/broadcast-client.tsx`

Expected: เหลือ **1 error** — `jsx-a11y/control-has-associated-label` `176:15` (input `datetime-local`) — ไม่มี `react-hooks/set-state-in-effect` และไม่มี error ใหม่

- [ ] **Step 5: typecheck**

Run: `npx tsc --noEmit`

Expected: ไม่มี output (exit 0)

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/chatbot/broadcast/broadcast-client.tsx
git commit -m "refactor(admin): ให้ broadcast โหลด/สร้าง/ส่งผ่าน useResource"
```

Expected: `[refactor/admin-resource-hook <sha>] refactor(admin): …` และ `1 file changed`

---

### Task 7: migrate files-client.tsx

**Files:**
- Modify: `src/app/admin/files/files-client.tsx:3`, `:8-16` (ลบ `interface MediaItem`), `:24-92`

**Interfaces:**
- Consumes: `adminApi.listMedia` / `uploadMedia` / `deleteMedia`, type `MediaItem`/`MediaPage`, `useResource`
- Produces: ไม่มี

- [ ] **Step 1: อ่านไฟล์เดิมทั้งหมดก่อนแก้**

Run: `npx eslint src/app/admin/files/files-client.tsx`

Expected (baseline): 2 errors + 1 warning — `react-hooks/set-state-in-effect` `52:21`, `jsx-a11y/control-has-associated-label` `113:15`, warn `@next/next/no-img-element` `133:21`

- [ ] **Step 2: เปลี่ยน import + ลบ type**

เดิม:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
```

ใหม่:

```tsx
import { useRef, useState } from 'react';
import type { MediaItem } from '@/app/admin/_lib/admin-api';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
```

ลบ `interface MediaItem { ... }` (`:8-16`) ทั้งก้อน; `formatSize()` (module-level) คงเดิม

- [ ] **Step 3: แทน state + `fetchItems` + effect + handlers (เดิม `:24-92`)**

```tsx
export function FilesClient() {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, loading, feedback, notify, mutate } = useResource({
    load: adminApi.listMedia,
  });
  const items = data?.items ?? [];
  const storageOk = data?.storageConfigured ?? true;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await mutate(() => adminApi.uploadMedia(file), 'อัปโหลดสำเร็จ');
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleDelete(item: MediaItem) {
    if (!confirm(`ลบ "${item.filename}" ?`)) return;
    // server คืน { error: 'ไม่พบไฟล์' } — mutate เอาข้อความนั้นมาแจ้ง ไม่โยนทิ้งเหมือนเดิม
    await mutate(() => adminApi.deleteMedia(item.id), 'ลบสำเร็จ');
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    notify('success', 'คัดลอก URL แล้ว');
  }
```

JSX ตั้งแต่ `return (` ลงไป **ไม่แก้เลย** (แบนเนอร์ `!storageOk`, กริดรูป, ปุ่มอัปโหลด ใช้ชื่อเดิม)

- [ ] **Step 4: gate lint ของไฟล์**

Run: `npx eslint src/app/admin/files/files-client.tsx`

Expected: เหลือ **1 error + 1 warning** — `jsx-a11y/control-has-associated-label` และ warn `@next/next/no-img-element` — ไม่มี `react-hooks/set-state-in-effect` และไม่มี error ใหม่

- [ ] **Step 5: typecheck**

Run: `npx tsc --noEmit`

Expected: ไม่มี output (exit 0)

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/files/files-client.tsx
git commit -m "refactor(admin): ให้ files โหลด/อัปโหลด/ลบผ่าน useResource — โชว์ error จาก server ตอนลบ"
```

Expected: `[refactor/admin-resource-hook <sha>] refactor(admin): …` และ `1 file changed`

---

### Task 8: migrate health-client.tsx (poll ทุก 30 วินาที)

**Files:**
- Modify: `src/app/admin/health/health-client.tsx:3`, `:8-19` (ลบ `interface Probe` + `interface HealthData`), `:21-51`

**Interfaces:**
- Consumes: `adminApi.getHealth`, type `HealthData`/`HealthProbe` (Task 1), `useResource` + `intervalMs` + `loadingOnReload` (Task 2)
- Produces: ไม่มี

**พฤติกรรมที่ต้องคงเดิม:** โหลดตอน mount, โหลดซ้ำทุก `30_000` ms, กด Refresh ได้, และ **ไม่** เปลี่ยน card เป็น "กำลังตรวจสอบ..." ระหว่าง reload (นั่นคือเหตุผลที่ส่ง `loadingOnReload: false`)

- [ ] **Step 1: อ่านไฟล์เดิมทั้งหมดก่อนแก้**

Run: `npx eslint src/app/admin/health/health-client.tsx`

Expected (baseline): 1 error — `react-hooks/set-state-in-effect` `38:5` (ผลข้างเคียงของ `useEffect` ที่เรียก `fetchHealth()` ซึ่งมี `setData`/`setLoading`)

- [ ] **Step 2: เปลี่ยน import + ลบ type ที่ย้ายไป adapter**

เดิม:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { HeartPulse, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { Button } from '@/components/ui/button';
```

ใหม่:

```tsx
import { HeartPulse, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { Button } from '@/components/ui/button';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
```

ลบ `interface Probe { ... }` (`:8-13`) และ `interface HealthData { ... }` (`:15-19`) ทั้งสองก้อน — ใช้ `HealthData`/`HealthProbe` จาก adapter

- [ ] **Step 3: แทน state + `fetchHealth` + effect (เดิม `:21-41`) และแก้ปุ่ม Refresh**

```tsx
export function HealthClient() {
  const { data, loading, feedback, reload } = useResource({
    load: adminApi.getHealth,
    intervalMs: 30_000,
    loadingOnReload: false, // คงพฤติกรรมเดิม: refresh ไม่ปิดข้อมูลระหว่างโหลด
  });

  if (loading) return <div className="py-12 text-center text-muted">กำลังตรวจสอบ...</div>;
  // § ห้าม return ก่อน banner — reload ล้มขณะมี data เดิมต้องเห็นข้อความจาก server ด้วย
  // health route คืน 401/403 `{ error: 'Unauthorized'|'Forbidden' }` เท่านั้น ไม่มี envelope อื่น
  const errorMsg = feedback?.type === 'error' ? feedback.msg : null;
```

แล้วแก้ JSX ของปุ่ม Refresh (`:50`) จาก `onClick={fetchHealth}` เป็น:

```tsx
          <Button variant="outline" onClick={() => void reload()} className="min-h-touch gap-1.5 text-sm">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
```

ใน JSX ของ `AdminCard` (หลัง `<AdminCardTitle>`) เพิ่มก่อน `!data ?`:

```tsx
      {errorMsg && <p className="text-sm text-danger">{errorMsg}</p>}
```

ส่วน JSX ที่เหลือ (`สถานะระบบ`, badge, รายการ probe, `อัปเดตล่าสุด`) ใช้ `data.probes` / `data.status` / `data.timestamp` เหมือนเดิม **ไม่แก้** — `errorMsg` ต้องโชว์ทั้งตอน `!data` (โหลดครั้งแรก) และตอนมี data แล้ว reload ล้ม

- [ ] **Step 3b: page test — ข้อความ error จาก server จริง**

สร้าง `src/app/admin/health/health-client.test.tsx` (บรรทัดแรก `// @vitest-environment jsdom`):

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: { getHealth: vi.fn() },
}));

import { adminApi } from '@/app/admin/_lib/admin-api';
import { HealthClient } from './health-client';

afterEach(() => {
  cleanup();
  vi.mocked(adminApi.getHealth).mockReset();
});

describe('HealthClient error', () => {
  it('โหลดครั้งแรก 401 แสดง Unauthorized ไม่ใช่หน้าว่าง', async () => {
    vi.mocked(adminApi.getHealth).mockResolvedValue({
      ok: false,
      error: 'Unauthorized',
      status: 401,
    });
    render(<HealthClient />);
    expect(await screen.findByText('Unauthorized')).toBeInTheDocument();
  });

  it('reload ล้ม 403 แสดง Forbidden ขณะการ์ดเดิมยังอยู่', async () => {
    vi.mocked(adminApi.getHealth)
      .mockResolvedValueOnce({
        ok: true,
        data: { status: 'healthy', probes: [], timestamp: '2026-10-03T00:00:00.000Z' },
      })
      .mockResolvedValueOnce({ ok: false, error: 'Forbidden', status: 403 });
    render(<HealthClient />);
    expect(await screen.findByText('ปกติ')).toBeInTheDocument();
    screen.getByRole('button', { name: /refresh/i }).click();
    await waitFor(() => expect(screen.getByText('Forbidden')).toBeInTheDocument());
    expect(screen.getByText('ปกติ')).toBeInTheDocument();
  });
});
```

Run: `npx vitest run src/app/admin/health/health-client.test.tsx`

Expected: 2 passed — ถ้าไม่เจอข้อความ แปลว่า JSX ไม่ได้เรนเดอร์ `feedback.msg`

- [ ] **Step 4: gate lint ของไฟล์**

Run: `npx eslint src/app/admin/health/health-client.tsx`

Expected: **ไม่มี output (exit 0)** — ไฟล์นี้ baseline มี error เดียวคือ set-state-in-effect พอ migrate แล้วต้องสะอาดหมด

- [ ] **Step 5: typecheck**

Run: `npx tsc --noEmit`

Expected: ไม่มี output (exit 0) — ถ้าขึ้น `Cannot find name 'HealthData'` แปลว่า Step 2 ลบ interface เดิมแล้วแต่ไม่ได้เอา type จาก adapter มาใช้

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/health/health-client.tsx src/app/admin/health/health-client.test.tsx
git commit -m "refactor(admin): ให้ health โหลด/ปิง 30s ผ่าน useResource — ปิด set-state-in-effect"
```

Expected: `[refactor/admin-resource-hook <sha>] refactor(admin): …` และ `1 file changed`

---

### Task 9: migrate settings-client.tsx

**Files:**
- Modify: `src/app/admin/settings/settings-client.tsx:3`, `:9-15` (ลบ `interface SettingsData`), `:19-74` และ handler ใน JSX (`bot_enabled`, `welcome_message`, `hours-start`, `hours-end`, `handoff-kw`)

**Interfaces:**
- Consumes: `adminApi.getSettings` / `saveSettings`, type `SettingsData`/`SettingsInput`, `useResource` (`clearFeedback`, `mutate` + `{ reload: false }`, `setData`)
- Produces: ไม่มี

**จุดที่ต่างจากหน้าอื่น:** หน้านี้มีหลาย field ที่ผู้ใช้แก้ค้างอยู่ในหน้า → `mutate` ต้องส่ง `{ reload: false }` เพื่อไม่ให้ดึงค่า server ทับงานที่ยังไม่ได้บันทึก และ `keywordsText` ต้อง **derive** ออกจาก `data` แทนที่จะ `setState` ใน `useEffect` (ไม่งั้นโดน rule เดิม)

- [ ] **Step 1: อ่านไฟล์เดิมทั้งหมดก่อนแก้**

Run: `npx eslint src/app/admin/settings/settings-client.tsx`

Expected (baseline): 1 error — `jsx-a11y/control-has-associated-label` `116:13` (ไม่มี `react-hooks/set-state-in-effect` เพราะของเดิม setState ใน `.then` — task นี้ย้ายมารวมกับหน้าอื่นเพื่อให้ทุกหน้าใช้ adapter/hook เดียวกัน)

- [ ] **Step 2: เปลี่ยน import + ลบ type**

เดิม:

```tsx
import { useEffect, useState } from 'react';
```

ใหม่:

```tsx
import { useState } from 'react';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
```

ลบ `interface SettingsData { ... }` (`:9-15`) ทั้งก้อน; คง `DAY_LABELS` ไว้เดิม

- [ ] **Step 3: แทน state + effect + handleSave + toggleDay (เดิม `:19-74`)**

```tsx
export function SettingsClient() {
  const { data, loading, feedback, clearFeedback, mutate, setData } = useResource({
    load: adminApi.getSettings,
  });
  const [saving, setSaving] = useState(false);
  // § keywordsText = null แปลว่ายังไม่เคยพิมพ์ → derive ค่าจาก server แทนที่จะ
  //   useEffect setState (rule set-state-in-effect จับการ setState ใน effect)
  const [keywordsText, setKeywordsText] = useState<string | null>(null);
  const keywords = keywordsText ?? data?.handoff_keywords.join(', ') ?? '';

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    clearFeedback();
    await mutate(
      () =>
        adminApi.saveSettings({
          welcome_message: data.welcome_message,
          handoff_keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
          business_hours: data.business_hours,
          bot_enabled: data.bot_enabled,
        }),
      'บันทึกตั้งค่าสำเร็จ',
      { reload: false }, // คงค่าที่ผู้ใช้แก้ค้างไว้ในหน้า — ไม่ดึงทับจาก server
    );
    setSaving(false);
  }

  function toggleDay(day: number) {
    setData((prev) => {
      if (!prev) return prev;
      const days = prev.business_hours.days.includes(day)
        ? prev.business_hours.days.filter((d) => d !== day)
        : [...prev.business_hours.days, day].sort();
      return { ...prev, business_hours: { ...prev.business_hours, days } };
    });
  }

  if (loading) return <div className="py-12 text-center text-muted">กำลังโหลด...</div>;
  // § ห้าม `if (!data) return null` ก่อน banner — โหลดครั้งแรกล้มต้องเห็น error ไม่ใช่หน้าว่าง
  if (!data) {
    return feedback?.type === 'error' ? (
      <div role="status" className="rounded-lg bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
        {feedback.msg}
      </div>
    ) : null;
  }
```

- [ ] **Step 4: แก้ handler ใน JSX ที่ยัง `setData({...data, …})` เป็น updater function**

เปลี่ยน 4 จุดนี้ (ชื่อ field เดิม ข้อความเดิม):

```tsx
              checked={data.bot_enabled}
              onChange={(e) => setData((prev) => (prev ? { ...prev, bot_enabled: e.target.checked } : prev))}
```

```tsx
              value={data.welcome_message}
              onChange={(e) => setData((prev) => (prev ? { ...prev, welcome_message: e.target.value } : prev))}
```

```tsx
              value={keywords}
              onChange={(e) => setKeywordsText(e.target.value)}
```

```tsx
                value={data.business_hours.start}
                onChange={(e) =>
                  setData((prev) =>
                    prev
                      ? { ...prev, business_hours: { ...prev.business_hours, start: e.target.value } }
                      : prev,
                  )
                }
```

```tsx
                value={data.business_hours.end}
                onChange={(e) =>
                  setData((prev) =>
                    prev
                      ? { ...prev, business_hours: { ...prev.business_hours, end: e.target.value } }
                      : prev,
                  )
                }
```

ส่วน JSX ที่เหลือ (แบนเนอร์ `feedback` ใน `return` หลัก, การ์ด LINE Channel, ปุ่มวัน, ปุ่มบันทึก) **ไม่แก้** — แบนเนอร์นั้นโชว์เมื่อมี `data` แล้ว; path `!data` ต้องมี banner ของตัวเองตาม snippet ด้านบน (ห้ามย้าย `if (!data) return null` กลับไปก่อน banner)

**ชน c5:** ถ้าไฟล์จริงมี `import { BUSINESS_DAY_LABELS as DAY_LABELS } from '@/lib/line/business-hours'` อยู่แล้ว ห้ามลบ และห้ามใส่ `const DAY_LABELS = [...]` กลับ คง type `business_hours` ที่ c5 เพิ่มใน `SettingsData`

- [ ] **Step 4b: page test — โหลดครั้งแรกล้มต้องไม่เป็นหน้าว่าง**

สร้าง `src/app/admin/settings/settings-client.test.tsx` (บรรทัดแรก `// @vitest-environment jsdom`):

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: { getSettings: vi.fn(), saveSettings: vi.fn() },
}));

import { adminApi } from '@/app/admin/_lib/admin-api';
import { SettingsClient } from './settings-client';

afterEach(() => {
  cleanup();
  vi.mocked(adminApi.getSettings).mockReset();
});

describe('SettingsClient initial error', () => {
  it('โหลดครั้งแรก 401 แสดง Unauthorized ไม่ใช่หน้าว่าง', async () => {
    vi.mocked(adminApi.getSettings).mockResolvedValue({
      ok: false,
      error: 'Unauthorized',
      status: 401,
    });
    const { container } = render(<SettingsClient />);
    expect(await screen.findByRole('status')).toHaveTextContent('Unauthorized');
    expect(container.querySelector('form, input, textarea')).toBeNull();
  });
});
```

Run: `npx vitest run src/app/admin/settings/settings-client.test.tsx`

Expected: 1 passed — ถ้า `container` ว่างและไม่มี `role="status"` แปลว่า `if (!data) return null` ยังอยู่ก่อน banner

- [ ] **Step 5: gate lint ของไฟล์**

Run: `npx eslint src/app/admin/settings/settings-client.tsx`

Expected: เหลือ **1 error เท่านั้น** — `jsx-a11y/control-has-associated-label` (checkbox "เปิดใช้งานบอทตอบอัตโนมัติ") — ไม่มี error ใหม่และไม่มี `react-hooks/set-state-in-effect`

- [ ] **Step 6: typecheck**

Run: `npx tsc --noEmit`

Expected: ไม่มี output (exit 0) — ถ้าขึ้น `Type 'string | null' is not assignable to type 'string'` ที่ `handoff-kw` แปลว่าใช้ `keywordsText` แทน `keywords`

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/settings/settings-client.tsx src/app/admin/settings/settings-client.test.tsx
git commit -m "refactor(admin): ให้ settings โหลด/บันทึกผ่าน useResource + derive keywords แทน effect sync"
```

Expected: `[refactor/admin-resource-hook <sha>] refactor(admin): …` และ `1 file changed`

---

### Task 10: migrate chatbot-dashboard-client.tsx

**Files:**
- Modify: `src/app/admin/chatbot/chatbot-dashboard-client.tsx:3`, `:7-13` (ลบ `interface Stats`), `:27-37`

**Interfaces:**
- Consumes: `adminApi.getChatbotStats`, type `ChatbotStats` (Task 1), `useResource` (Task 2)
- Produces: ไม่มี

**จุดที่ต่าง:** ของเดิม `catch(() => {})` กลืน error ทั้งก้อน — พอใช้ hook แล้ว load ล้มเหลวต้องโชว์ `feedback.msg` จาก server (401/403 = `Unauthorized`/`Forbidden`) ไม่ใช่ข้อความทั่วไปอย่างเดียว

- [ ] **Step 1: อ่านไฟล์เดิมทั้งหมดก่อนแก้**

Run: `npx eslint src/app/admin/chatbot/chatbot-dashboard-client.tsx`

Expected (baseline): ไม่มี error/warning (ไฟล์สะอาดก่อนเริ่ม — ของเดิม setState ใน `.then`)

- [ ] **Step 2: เปลี่ยน import + ลบ type**

เดิม:

```tsx
import { useEffect, useState } from 'react';
```

ใหม่:

```tsx
import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
```

ลบ `interface Stats { ... }` (`:7-13`) ทั้งก้อน — ใช้ `ChatbotStats` จาก adapter (รูป field ตรงกัน: `messages`, `faq`, `conversations`, `topFaq`); คง `KpiCard` ไว้เดิม

- [ ] **Step 3: แทน state + effect (เดิม `:27-37`)**

```tsx
export function ChatbotDashboardClient() {
  const { data: stats, loading, feedback } = useResource({
    load: adminApi.getChatbotStats,
  });

  if (loading) return <div className="py-12 text-center text-muted">กำลังโหลด...</div>;
  if (!stats) {
    return (
      <div className="py-12 text-center text-danger">
        {feedback?.type === 'error' ? feedback.msg : 'โหลดข้อมูลไม่สำเร็จ'}
      </div>
    );
  }
```

JSX ที่เหลือ (KPI grid + ตาราง Top FAQ) **ไม่แก้**

- [ ] **Step 3b: page test — ข้อความ error จาก server**

สร้าง `src/app/admin/chatbot/chatbot-dashboard-client.test.tsx` (บรรทัดแรก `// @vitest-environment jsdom`):

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: { getChatbotStats: vi.fn() },
}));

import { adminApi } from '@/app/admin/_lib/admin-api';
import { ChatbotDashboardClient } from './chatbot-dashboard-client';

afterEach(() => {
  cleanup();
  vi.mocked(adminApi.getChatbotStats).mockReset();
});

describe('ChatbotDashboardClient error', () => {
  it('403 แสดง Forbidden ไม่ใช่ข้อความทั่วไปอย่างเดียว', async () => {
    vi.mocked(adminApi.getChatbotStats).mockResolvedValue({
      ok: false,
      error: 'Forbidden',
      status: 403,
    });
    render(<ChatbotDashboardClient />);
    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
    expect(screen.queryByText('โหลดข้อมูลไม่สำเร็จ')).not.toBeInTheDocument();
  });
});
```

Run: `npx vitest run src/app/admin/chatbot/chatbot-dashboard-client.test.tsx`

Expected: 1 passed

- [ ] **Step 4: gate lint ของไฟล์**

Run: `npx eslint src/app/admin/chatbot/chatbot-dashboard-client.tsx`

Expected: **ไม่มี output (exit 0)**

- [ ] **Step 5: typecheck**

Run: `npx tsc --noEmit`

Expected: ไม่มี output (exit 0)

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/chatbot/chatbot-dashboard-client.tsx src/app/admin/chatbot/chatbot-dashboard-client.test.tsx
git commit -m "refactor(admin): ให้ chatbot dashboard โหลด stats ผ่าน useResource — เอา catch(() => {}) ออก"
```

Expected: `[refactor/admin-resource-hook <sha>] refactor(admin): …` และ `1 file changed`

---

### Task 11: migrate chat/_hooks/use-conversations.ts (ลบ eslint-disable)

**Files:**
- Modify: `src/app/admin/chat/_hooks/use-conversations.ts:1-42` (imports, load effect, `togglePref`, `markReadLocal`) — ส่วน `counts`/`visible`/`return` (`:44-90`) คงเดิม

**Interfaces:**
- Consumes: `useResource` + `ApiResult` (Task 1-2), `fetchConversations`/`putPrefs` จาก `src/app/admin/chat/_lib/api.ts` (**ไม่แก้ไฟล์นี้**)
- Produces: `useConversations()` คง contract เดิมทุกประการ — `chat-client.tsx` เรียก `loadConversations`, `useMessages(loadConversations)`, `togglePref`, `markReadLocal`, `counts`, `visible`, `loading`, `filter`/`sort`/`query` + setter ได้เหมือนเดิม และได้ `feedback` เพิ่มเพื่อโชว์ error จาก server

**จุดที่ต่าง:** ของเดิมมี `// eslint-disable-next-line react-hooks/set-state-in-effect` ค้างอยู่ (`:24`) เพราะเรียก `loadConversations` (useCallback ที่มี setState) จาก effect — พอ effect ย้ายเข้า hook แล้ว disable นั้นต้องถูกลบ

- [ ] **Step 1: อ่านไฟล์เดิมทั้งหมดก่อนแก้ + อ่าน caller**

Run: `npx eslint src/app/admin/chat/_hooks/use-conversations.ts`

Expected (baseline): ไม่มี error (ถูก `eslint-disable` ปิดไว้ 1 บรรทัด) — และเปิดอ่าน `src/app/admin/chat/chat-client.tsx:37-84` ว่าใช้ `loadConversations` / `togglePref` / `markReadLocal` อย่างไร

- [ ] **Step 2: แทน head ของ hook (เดิม `:1-42`)**

```ts
'use client';

import { useCallback, useMemo, useState } from 'react';
import { fetchConversations, putPrefs } from '../_lib/api';
import type { ApiResult } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import type { Conversation } from '../_lib/types';

export type ConversationFilter = 'all' | 'waiting' | 'active';
export type ConversationSort = 'newest' | 'oldest';

// reference คงที่ — ถ้าสร้าง arrow inline ใน component จะทำให้ effect รันซ้ำทุก render
const EMPTY_CONVERSATIONS: Conversation[] = [];

/**
 * ปรับ adapter ของหน้าแชทให้เข้ารูป ApiResult
 * § fetchConversations คืน null ทั้ง network fail และ !res.ok — อ่าน body เองเมื่อ !ok
 * เพื่อไม่ให้ข้อความ server (401 Unauthorized / 403 Forbidden) หายเป็นข้อความทั่วไป
 */
const loadConversationsAdapter = async (): Promise<ApiResult<Conversation[]>> => {
  const res = await fetch('/api/line/admin/conversations');
  if (res.ok) {
    const rows = (await res.json().catch(() => null)) as Conversation[] | null;
    return rows
      ? { ok: true, data: rows }
      : { ok: false, error: 'โหลดข้อมูลไม่สำเร็จ', status: res.status };
  }
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  const error = typeof body?.error === 'string' && body.error.length > 0 ? body.error : 'โหลดข้อมูลไม่สำเร็จ';
  return { ok: false, error, status: res.status };
};

export function useConversations() {
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [sort, setSort] = useState<ConversationSort>('newest');
  const [query, setQuery] = useState('');

  // § loadingOnReload:false — ของเดิม loadConversations ไม่ยก loading ในการโหลดครั้งถัดไป
  // SSE เรียก reload บ่อย ถ้า loading=true list จะถูกแทนด้วย SkeletonRows (conversation-list.tsx)
  const { data, loading, feedback, setData, reload } = useResource({
    load: loadConversationsAdapter,
    loadingOnReload: false,
  });
  const conversations = useMemo(() => data ?? EMPTY_CONVERSATIONS, [data]);
  // คงชื่อเดิมให้ chat-client และ useMessages เรียกต่อได้โดยไม่ต้องแก้ caller
  const loadConversations = reload;

  // pin/mute — optimistic แล้วค่อย sync; พลาดก็ revert ด้วย refetch
  const togglePref = useCallback(
    (id: string, patch: { pinned?: boolean; muted?: boolean }) => {
      setData((prev) => prev?.map((c) => (c.id === id ? { ...c, ...patch } : c)) ?? null);
      void putPrefs(id, patch).then((ok) => {
        if (!ok) void reload();
      });
    },
    [setData, reload],
  );

  // เคลียร์ unread ทันทีตอนเปิดห้อง — ไม่รอ broadcast กลับมา
  const markReadLocal = useCallback(
    (id: string) => {
      setData((prev) => prev?.map((c) => (c.id === id ? { ...c, unreadAdmin: 0 } : c)) ?? null);
    },
    [setData],
  );
```

สิ่งที่หายไป: `useState` ของ `conversations`/`loading`, `loadConversations` แบบ `useCallback` ที่มี setState, `useEffect` mount ที่มี `eslint-disable` ทั้งบรรทัด (`:23-26`) — **`counts` (`:44-51`), `visible` (`:53-73`) คงเดิมทุกตัวอักษร**

ใน block `return` (`:75-90`) เพิ่ม `feedback` หนึ่ง field (ที่เหลือคงเดิม):

```ts
  return {
    conversations,
    visible,
    counts,
    loading,
    feedback,
    filter,
```

ใน `src/app/admin/chat/chat-client.tsx` destructure `feedback` จาก `useConversations()` แล้วเรนเดอร์เหนือ `<ConversationList>` (ใน flex container เดิม):

```tsx
      {feedback?.type === 'error' && (
        <p role="status" className="px-3 py-2 text-sm text-danger">{feedback.msg}</p>
      )}
```

ห้ามให้ `loading` จาก reload ไปแทน list — นั่นคือเหตุผลของ `loadingOnReload: false`

- [ ] **Step 3: gate lint ของไฟล์**

Run: `npx eslint src/app/admin/chat/_hooks/use-conversations.ts`

Expected: **ไม่มี output (exit 0)** และ **ต้องไม่เหลือ** `eslint-disable` ในไฟล์

ตรวจ (PowerShell): `Select-String -Path src/app/admin/chat/_hooks/use-conversations.ts -Pattern eslint-disable`

เทียบเท่า bash: `grep -n eslint-disable src/app/admin/chat/_hooks/use-conversations.ts`

Expected: ไม่มี output

- [ ] **Step 3b: page-level test — error จาก server + reload ไม่ยก loading**

`ChatClient` เปิด `EventSource` ตอน mount (`use-chat-sse.ts`) — ห้ามเรนเดอร์ทั้งหน้าใน unit test. เรนเดอร์ `ConversationList` ด้วยค่าจาก `useConversations()` จริง (path ที่ผู้ใช้เห็น: `role="status"` + ไม่มี `.animate-pulse` ตอน reload)

สร้าง `src/app/admin/chat/_hooks/use-conversations.test.tsx` (บรรทัดแรก `// @vitest-environment jsdom`):

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversationList } from '../_components/conversation-list';
import { useConversations } from './use-conversations';

function jsonRes(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

function Probe() {
  const { visible, counts, loading, feedback, filter, setFilter, sort, setSort, query, setQuery, loadConversations } =
    useConversations();
  return (
    <>
      {feedback?.type === 'error' && <p role="status">{feedback.msg}</p>}
      <button type="button" onClick={() => void loadConversations()}>reload</button>
      <ConversationList
        visible={visible}
        counts={counts}
        loading={loading}
        filter={filter}
        setFilter={setFilter}
        sort={sort}
        setSort={setSort}
        query={query}
        setQuery={setQuery}
        searchResults={[]}
        searching={false}
        selectedId={null}
        onSelect={() => {}}
        onTogglePin={() => {}}
        onToggleMute={() => {}}
      />
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('inbox error ที่ผู้ใช้เห็น', () => {
  it('401 แสดง Unauthorized ไม่ใช่ข้อความทั่วไป', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonRes({ error: 'Unauthorized' }, false, 401)));
    render(<Probe />);
    expect(await screen.findByRole('status')).toHaveTextContent('Unauthorized');
    expect(screen.queryByText('โหลดข้อมูลไม่สำเร็จ')).not.toBeInTheDocument();
  });

  it('reload ครั้งถัดไปไม่ยก loading — list ไม่ถูกแทนด้วย skeleton', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        return calls === 1 ? jsonRes([]) : jsonRes({ error: 'Forbidden' }, false, 403);
      }),
    );
    render(<Probe />);
    await screen.findByText('ยังไม่มีการสนทนา');
    screen.getByRole('button', { name: 'reload' }).click();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Forbidden'));
    expect(screen.getByText('ยังไม่มีการสนทนา')).toBeInTheDocument();
    expect(document.querySelector('.animate-pulse')).toBeNull();
  });
});
```

Run: `npx vitest run src/app/admin/chat/_hooks/use-conversations.test.tsx`

Expected: 2 passed — ถ้าเจอ skeleton ตอน reload แปลว่าไม่ได้ส่ง `loadingOnReload: false`

- [ ] **Step 4: typecheck + unit test ของหน้าแชท**

Run: `npx tsc --noEmit`

Expected: ไม่มี output (exit 0) — ถ้า `chat-client.tsx` ฟ้อง type ที่ `loadConversations` ให้ตรวจว่า `const loadConversations = reload;` ยังอยู่

Run: `npx vitest run src/app/admin/chat/_hooks`

Expected:

```
 Test Files  2 passed (2)
      Tests  … passed
```

(`use-messages.test.ts`, `use-note-autosave.test.ts` ต้องผ่านโดยไม่แก้ test เดิม)

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/chat/_hooks/use-conversations.ts src/app/admin/chat/chat-client.tsx src/app/admin/chat/_hooks/use-conversations.test.tsx
git commit -m "refactor(admin): ให้ use-conversations โหลดผ่าน useResource — ลบ eslint-disable set-state-in-effect"
```

Expected: `[refactor/admin-resource-hook <sha>] refactor(admin): …` และ `1 file changed`

---

### Task 12: gate สุดท้าย + push + PR

**Files:** ไม่มีไฟล์ใหม่

**Interfaces:**
- Consumes: ผลรวมของ Task 1-11
- Produces: สาขาพร้อม merge, PR

- [ ] **Step 1: ยืนยันว่า rule set-state-in-effect เหลือศูนย์**

Run (PowerShell): `npx eslint . 2>&1 | Select-String set-state-in-effect; if (-not $?) { 'ไม่เหลือ set-state-in-effect' }`

เทียบเท่า bash: `npx eslint . 2>&1 | grep set-state-in-effect || echo "ไม่เหลือ set-state-in-effect"`

Expected: `ไม่เหลือ set-state-in-effect` (ทั้ง 6 จุดเดิมหายหมด: auto-replies, broadcast, reply-objects, rich-menus, files, health)

- [ ] **Step 2: ยืนยันนับ problems รวม**

Run (PowerShell): `npx eslint . 2>&1 | Select-Object -Last 1`

เทียบเท่า bash: `npx eslint . 2>&1 | tail -1`

Expected: `✖ 18 problems (15 errors, 3 warnings)` — baseline ก่อนเริ่มคือ `24 problems (21 errors, 3 warnings)` ต่างกัน exactly 6 errors ที่เป็น `react-hooks/set-state-in-effect`

**ไม่ใช่ exit 0 ทั้ง repo.** 15 errors ที่เหลือเป็น baseline นอกแผน ห้ามแก้เพื่อไล่เขียว และห้ามประกาศ merge gate จาก lint ทั้ง repo. สิ่งที่ต้องจริง: **ไม่เพิ่ม error นอก 6 จุดที่ตั้งใจแก้** — ถ้าได้ค่าอื่น ให้ไล่ดูไฟล์ที่มี error ใหม่ (มักเป็น unused import จาก task ที่ลบ `useCallback`/`useEffect` ไม่ครบ) แล้วแก้ในไฟล์นั้น

- [ ] **Step 3: typecheck**

Run: `npx tsc --noEmit`

Expected: ไม่มี output (exit 0)

- [ ] **Step 4: unit test ทั้งหมด (ไม่แตะ integration)**

Run: `npx vitest run --exclude '**/*.integration.test.ts'`

Expected: `Test Files  … passed` ทุกไฟล์, `Tests  … passed`, `Failed  0` — รวม test ใหม่ `admin-api.test.ts` (5 tests), `use-resource.test.ts` (12 tests) และ page test ของ health/dashboard/settings/chat (Task 8-11)

- [ ] **Step 5: smoke test หน้าจอจริง (ต้องมี Docker + .env.local)**

```bash
docker compose up -d postgres redis up-redis
npx next dev
```

แล้วเปิดตรวจ 4 หน้า: `/admin/chatbot/auto-replies` (พิมพ์ค้นหา → ตารางโหลดซ้ำ 1 ครั้งต่อ 300ms ไม่ยิงรัว, Favicon Network ดู request `/api/line/admin/faq` ครั้งเดียวตอนเปิด), `/admin/health` (ข้อมูลอัปเดตเองทุก 30 วิ ไม่กระพริบเป็น "กำลังตรวจสอบ..."), `/admin/files` (ลบไฟล์ที่ server ปฏิเสธ → ข้อความไทยจาก server ขึ้น banner), `/admin/chat` (list ห้องโหลด + pin/mute ทำงาน)

Expected: ทั้งสี่หน้าทำงานเหมือนก่อน, banner แจ้งผลหายเองใน 4 วินาที, ไม่มี error ใน console

- [ ] **Step 6: push + เปิด PR**

```bash
git push -u origin refactor/admin-resource-hook
gh pr create --title "refactor(admin): รวมหน้า admin 9 หน้าเข้า client adapter + useResource hook" --body "ดู plan: docs/superpowers/plans/2026-10-03-admin-resource-hook.md

- เพิ่ม src/app/admin/_lib/admin-api.ts (parse error envelope ที่เดียว) + use-resource.ts (โหลด/แก้แล้วโหลดใหม่/แจ้งผล/timer/กัน response ช้า)
- ย้าย 9 หน้า: auto-replies, reply-objects, rich-menus, broadcast, files, health, settings, chatbot dashboard, use-conversations
- ปิด react-hooks/set-state-in-effect ทั้ง 6 จุดโดยไม่ใช้ eslint-disable
- gate: npx eslint . = 18 problems (15 errors, 3 warnings) จาก baseline 24 — ไม่ใช่ exit 0 ทั้ง repo (ไม่เพิ่ม error นอก 6 จุดที่ตั้งใจแก้); npx tsc --noEmit สะอาด; vitest unit ผ่านทั้งหมด"
```

Expected: PR URL ของ `Arnutt-N/huangua-works` — GitHub Actions ปิดอยู่โดยตั้งใจ ไม่ต้องรอ CI ให้ review ผ่าน Vercel Preview + gate ขั้น 1-4

- [ ] **Step 7: merge (เมื่อ Vercel Preview OK)**

```bash
gh pr merge --squash
```

Expected: `✓ Squashed and merged`

---

## Self-Review

รันเองหลังเขียน plan จบ (ตาม writing-plans — ไม่ใช่ subagent)

**1. Spec coverage (การ์ด `id="c3"` + รายละเอียดใน brief)**

| ข้อกำหนดจาก spec | อยู่ใน task ไหน |
|---|---|
| 9 หน้า hand-roll state+effect+fetch+notify: auto-replies, reply-objects, rich-menus, broadcast, files, health, settings, chatbot-dashboard, use-conversations | Task 3, 4, 5, 6, 7, 8, 9, 10, 11 (ครบ 9) |
| ปิด ESLint `react-hooks/set-state-in-effect` 6 จุด (auto-replies:71, broadcast:70, reply-objects:64, rich-menus:69, files:52, health:38) | Task 3 (auto-replies), 6 (broadcast), 4 (reply-objects), 5 (rich-menus), 7 (files), 8 (health) + gate Task 12 Step 1 |
| auto-replies โหลดซ้ำสองครั้งตอน mount (`:70-77`) | Task 3 — รวมสอง effect เป็น effect เดียวใน hook ที่โหลดครั้งแรกด้วย delay 0 (มี test `mount โหลดครั้งเดียว` ใน Task 2) |
| ไม่มี stale-response guard ตอนค้นหาแบบ debounce | Task 2 — `seqRef` + `cancelled` + test `ทิ้ง response ของ request เก่าที่มาช้ากว่า` |
| `notify` ตั้ง `setTimeout` ไม่เคยล้าง (6 สำเนา) | Task 2 — `notifyTimerRef` เคลียร์ timer เก่าก่อนตั้งใหม่ + cleanup ตอน unmount; test `notify ซ้ำ` + test `unmount` |
| DELETE ทิ้งข้อความ error จาก server | Task 3 (`deleteFaq` เดิม `throw new Error()`) และ Task 7 (`deleteMedia` เดิม `throw new Error()`) — `mutate` ส่ง `res.error` จาก envelope ให้เห็นตรง ๆ; Task 1 ทดสอบ parsing ไว้แล้ว |
| client adapter ตัวอย่าง `chat/_lib/api.ts` + mock ใน test | Task 1 เขียน `admin-api.ts` ตามแนว `jsonOrNull`/envelope ของ `chat/_lib/api.ts` (ไม่แก้ไฟล์เดิม), Task 11 adapt `fetchConversations` เข้า hook โดยยัง import จาก `chat/_lib/api.ts` เดิม |
| seam 2 ตัว: fetch adapter + in-memory adapter | Task 1 test ใช้ `vi.stubGlobal('fetch')` (adapter จริง); Task 2 test ใช้ `makeAdapter()` in-memory (hook) |
| test hook ด้วย `@testing-library/react` `renderHook` + jsdom | Task 2 — pragma `// @vitest-environment jsdom`, แบบอย่าง `use-messages.test.ts` / `use-note-autosave.test.ts` (fake timers + `advanceTimersByTimeAsync`) |
| ทุก task จบด้วย `npx eslint <files>` สะอาด + `npx tsc --noEmit` | Task 3-11 มี step gate ทุก task, Task 12 รวม gate |
| Final: `npx eslint .` เห็น 6 จุดหาย; baseline 24 problems / 21 errors / 3 warnings | Task 12 Step 1-2 — คาด `18 problems (15 errors, 3 warnings)` และไม่เพิ่ม error นอก 6 จุด; **ไม่ใช่** exit 0 ทั้ง repo |
| Task 0 `git checkout main && git pull && git checkout -b refactor/admin-resource-hook` | Task 0 Step 1 (verbatim) |
| อ่านหน้าจอทุกไฟล์ก่อนเขียน migration | Task 3-11 Step 1 ทุก task = อ่าน + รัน baseline eslint ของไฟล์นั้นก่อนแก้ |

**Gap ที่พบและแก้แล้ว**
- `image-resize-client.tsx` มี `setTimeout(() => setFeedback…)` และ `fetch('/api/line/admin/media')` เหมือนกัน แต่ **ไม่อยู่ในการ์ด c3** และไม่มี error `set-state-in-effect` → ปล่อยไว้ (นอก scope), บันทึกเป็นความเสี่ยงด้านล่าง
- baseline มี error อื่นที่ไม่เกี่ยว (`react/no-unescaped-entities` ×6, `jsx-a11y/control-has-associated-label` ×5, `@next/next/no-img-element` ×1) → คงไว้ตาม constraint และกำหนด expected ต่อไฟล์ไว้ในแต่ละ task ให้เทียบได้

**2. Placeholder scan**

ไม่พบ `TBD`, `TODO`, `implement later`, `fill in details`, `Add appropriate error handling`, `Write tests for the above` (มี test code จริงทุก test step), `Similar to Task N` (โค้ด migration เขียนครบทุก task), หรือ step ที่บอก "ทำอะไร" โดยไม่บอก "ทำยังไง" — ทุก code step มีบล็อกโค้ดจริงและทุก run step มีคำสั่ง + expected output

**3. Type consistency (ไล่ชื่อข้าม task)**

- `ApiResult<T>` / `ApiOk` / `ApiFail` / `OkBody` / `ListOf<T>` — นิยามที่ Task 1, ใช้ที่ Task 2 (`import type { ApiResult }`), Task 11 — ตรงกัน
- `adminApi.<method>` ชื่อเดียวกันทุกจุดที่อ้าง: `listFaq`, `createFaq`, `updateFaq`, `deleteFaq`, `listReplyObjects`, `createReplyObject`, `updateReplyObject`, `deleteReplyObject`, `listRichMenus`, `createRichMenu`, `syncRichMenu`, `publishRichMenu`, `listBroadcasts`, `createBroadcast`, `sendBroadcast`, `listMedia`, `uploadMedia`, `deleteMedia`, `getHealth`, `getSettings`, `saveSettings`, `getChatbotStats` — ตรงกับ block `export const adminApi` ใน Task 1
- `useResource({ load, query, debounceMs, intervalMs, loadingOnReload })` → `{ data, loading, feedback, notify, clearFeedback, reload, mutate, setData }` — ใช้ครบทุก field ที่ declare โดยแต่ละ task destructures เฉพาะที่ใช้ (กัน unused-import/unused-var)
- `mutate(fn, successMsg, { reload?: boolean })` → `Promise<boolean>` — Task 3/4/5/6/7 ใช้ค่า `ok` ปิด dialog, Task 9 ส่ง `{ reload: false }`, Task 8/10/11 ไม่ใช้ `mutate`
- `Feedback = { type: 'success' | 'error'; msg: string } | null` — ตรงกับ JSX banner เดิมทุกหน้า (`feedback.type`, `feedback.msg`)
- `Conversation[]` (Task 11) กับ `counts`/`visible` ที่ใช้ `conversations` — คงของเดิม







