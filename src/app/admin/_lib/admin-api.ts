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
