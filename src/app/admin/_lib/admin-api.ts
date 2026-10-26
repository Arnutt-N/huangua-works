/**
 * client adapter ของ /api/line/admin/* — parse error envelope ที่เดียว
 *
 * § ก่อนรวม: 7 ไฟล์หน้าจอ fetch + parse `{ error }` เองซ้ำ 11 ครั้ง และ handler DELETE
 *   บางจุด `throw new Error()` เฉย ๆ จนข้อความไทยจาก server (เช่น 409 ของ reply-objects
 *   ที่บอกว่าถูกอ้างอยู่กี่ที่) หายไปจากผู้ใช้ — ดู architecture-review card c3
 * § endpoint คืนรูปไม่ตรงกัน: GET รายการคืน `{ items, total? }` ส่วน settings/health/stats
 *   คืน object เปล่า และ error คืน `{ error }` + status จึงห้าม assume ว่าทุกจุดคืนรูปเดียว
 */

import type { RichMenuDisplayMode } from '@/lib/contracts';

export type ApiOk<T> = { ok: true; data: T };
export type ApiFail = { ok: false; error: string; status: number; code?: 'SESSION_EXPIRED' | 'FORBIDDEN' | 'NETWORK' | 'TIMEOUT' | 'HTTP' };
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

export type IntentMatchType = 'exact' | 'starts_with' | 'contains' | 'regex';

export interface IntentKeyword {
  id: string;
  keyword: string;
  matchType: IntentMatchType;
}

export interface IntentResponse {
  id: string;
  replyType: 'text' | 'reply_object';
  textContent: string | null;
  replyObjectId: string | null;
  displayOrder: number;
}

export interface IntentItem {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  keywords: IntentKeyword[];
  responses: IntentResponse[];
}

export interface IntentPayload {
  name: string;
  description?: string | null;
  isActive: boolean;
  keywords: { keyword: string; matchType: IntentMatchType }[];
  responses: {
    replyType: 'text' | 'reply_object';
    textContent?: string | null;
    replyObjectId?: string | null;
    displayOrder?: number;
  }[];
}

export type IntentPatch = Partial<IntentPayload>;

export interface ReplyObject {
  id: string;
  objectId: string;
  name: string | null;
  category: string | null;
  objectType: string;
  payload: Record<string, unknown>;
  altText: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ReplyObjectInput {
  objectId: string;
  name?: string;
  category?: string;
  objectType: string;
  payload: Record<string, unknown>;
  altText?: string; // create schema รับ string optional เท่านั้น — ไม่รับ null (route.ts createSchema)
  isActive: boolean;
}

export interface ReplyObjectPatch {
  name?: string | null;
  category?: string | null;
  objectType: string;
  payload: Record<string, unknown>;
  altText?: string | null; // update schema รับ null ได้ (route.ts updateSchema)
  isActive: boolean;
}



export interface RichMenuAreaInput {
  bounds: { x: number; y: number; width: number; height: number };
  action: { type: string; uri?: string; text?: string; richMenuAliasId?: string };
}

export interface RichMenuItem {
  id: string;
  name: string;
  chatBarText: string;
  lineRichMenuId: string | null;
  status: string;
  displayMode: string;
  syncStatus: string;
  lastSyncError: string | null;
  imageUrl: string | null;
  displayStartAt: string | null;
  displayEndAt: string | null;
  createdAt: string;
  userLinkCount?: number;
}

export interface RichMenuConfig {
  size: { width: number; height: number };
  selected?: boolean;
  name?: string;
  chatBarText?: string;
  areas?: RichMenuAreaInput[];
}

export interface RichMenuItemDetail extends RichMenuItem {
  config: RichMenuConfig;
}

export interface RichMenuInput {
  name: string;
  chatBarText: string;
  config: unknown;
  displayMode?: RichMenuDisplayMode;
  displayStartAt?: string;
  displayEndAt?: string;
}

export interface RichMenuPatch {
  name?: string;
  chatBarText?: string;
  areas?: RichMenuAreaInput[];
  displayMode?: RichMenuDisplayMode;
  displayStartAt?: string | null;
  displayEndAt?: string | null;
}

export interface RichMenuInsightMetric {
  count: number;
  unique_users: number;
}

export interface RichMenuInsightSummary {
  rich_menu_id: string;
  metrics_from: string | null;
  metrics_to: string | null;
  impression: RichMenuInsightMetric | null;
  clicks: { bound: string; count: number; unique_users: number }[] | null;
  privacy_restricted: boolean;
}

export interface RichMenuInsightDailyPoint {
  date: string;
  count: number;
  unique_users: number;
}

export interface RichMenuInsightDaily {
  rich_menu_id: string;
  metrics_from: string | null;
  metrics_to: string | null;
  impression: { metrics: RichMenuInsightDailyPoint[] } | null;
  clicks: { bound: string; metrics: RichMenuInsightDailyPoint[] }[] | null;
  privacy_restricted: boolean;
}

export interface FriendItem {
  id: string;
  maskedId: string | null;
  displayName: string | null;
  pictureUrl: string | null;
  followState: 'following' | 'unfollowed';
  followCount: number;
  refollowCount: number;
  lastFollowAt: string | null;
  chatMode: string | null;
  lastActiveAt: string | null;
  richMenuId: string | null;
  richMenuName: string | null;
}

export interface FriendsPage extends ListOf<FriendItem> {
  total: number;
  page: number;
  pageSize: number;
}

export interface FriendEventItem {
  id: string;
  friendId: string;
  event: 'follow' | 'unfollow';
  createdAt: string;
  displayName: string | null;
  pictureUrl: string | null;
  maskedId: string | null;
}

export interface RichMenuAliasItem {
  aliasId: string;
  richMenuId: string;
  menuName: string | null;
  syncStatus: string | null;
}

export type BroadcastTarget =
  | { kind: 'all' }
  | { kind: 'line_user_ids'; ids: string[] };

export interface BroadcastContent {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface BroadcastItem {
  id: string;
  title: string | null;
  content: BroadcastContent[];
  status: string;
  target: BroadcastTarget;
  scheduledAt: string | null;
  sentAt: string | null;
  updatedAt: string | null;
  totalRecipients: number;
  successCount: number;
  failedCount: number;
  failedRecipients: number;
  createdAt: string;
}

export interface BroadcastInput {
  title?: string | null;
  content: BroadcastContent[];
  target: BroadcastTarget;
  scheduledAt: string | null;
}

export interface BroadcastPage extends ListOf<BroadcastItem> {
  total: number;
  page: number;
  pageSize: number;
}

export interface BroadcastRecipientOption {
  id: string;
  displayName: string | null;
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

export interface LineQuotaData {
  type: 'limited' | 'none';
  limit: number | null;
  used: number;
  remaining: number | null;
}

export interface SettingsData {
  welcome_message: string;
  handoff_keywords: string[];
  business_hours: { start: string; end: string; days: number[] };
  bot_enabled: boolean;
  line_notify_enabled: boolean;
  line: { configured: boolean; maskedToken: string | null };
}

export type SettingsInput = Omit<SettingsData, 'line'>;

export interface SystemSettingsData {
  maintenance_mode: boolean;
  audit_retention_days: number;
  import_default_org: 'huangua';
}

export interface SystemSettingsInput {
  maintenance_mode?: boolean;
  audit_retention_days?: number;
}

export interface ApiConnectionItem {
  provider: string;
  endpoint: string;
  status: string;
  lastCheckedAt: string | null;
}

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

// § timeout 15s ทุก request — Safari < 17.4 ไม่มี AbortSignal.timeout (โยน TypeError) → fallback เอง
const REQUEST_TIMEOUT_MS = 15_000;

function timeoutSignal(external?: AbortSignal): { signal: AbortSignal; cleanup: () => void; timedOut: () => boolean } {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer =
    typeof AbortSignal.timeout === 'function'
      ? null
      : setTimeout(() => {
          timedOut = true;
          ctrl.abort(new Error('timeout'));
        }, REQUEST_TIMEOUT_MS);
  const onExternalAbort = () => ctrl.abort(external?.reason);
  external?.addEventListener('abort', onExternalAbort, { once: true });
  const timeoutSig =
    typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : null;
  if (timeoutSig) {
    timeoutSig.addEventListener('abort', () => {
      timedOut = true;
      ctrl.abort(timeoutSig.reason);
    });
  }
  return {
    signal: ctrl.signal,
    cleanup: () => {
      if (timer !== null) clearTimeout(timer);
      external?.removeEventListener('abort', onExternalAbort);
    },
    timedOut: () => timedOut,
  };
}

// § caller abort (unmount/query เปลี่ยน) ต้องไม่ตั้ง error — แยกจาก timeout ด้วย timedOut()
function isCallerAbort(err: unknown, timedOut: boolean): boolean {
  return !timedOut && err instanceof DOMException && err.name === 'AbortError';
}

async function request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<ApiResult<T>> {
  const external = init?.signal ?? null;
  const { signal, cleanup, timedOut } = timeoutSignal(external ?? undefined);
  let res: Response;
  try {
    res = await fetch(path, { ...init, signal });
  } catch (err) {
    cleanup();
    if (isCallerAbort(err, timedOut())) throw err;
    if (timedOut()) return { ok: false, error: 'หมดเวลาเชื่อมต่อ กรุณาลองใหม่', status: 0, code: 'TIMEOUT' };
    return { ok: false, error: 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ', status: 0, code: 'NETWORK' };
  }
  cleanup();
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const envelope = (body as { error?: unknown } | null)?.error;
    const msg =
      typeof envelope === 'string' && envelope.length > 0 ? envelope : fallbackError(res.status);
    if (res.status === 401) return { ok: false, error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', status: 401, code: 'SESSION_EXPIRED' };
    if (res.status === 403) return { ok: false, error: 'ไม่มีสิทธิ์ทำรายการนี้', status: 403, code: 'FORBIDDEN' };
    return { ok: false, error: msg, status: res.status, code: 'HTTP' };
  }
  return { ok: true, data: body as T };
}

export const adminApi = {
  // ── FAQ / ตอบอัตโนมัติ ──
  listFaq: (query = '', opts?: { signal?: AbortSignal }): Promise<ApiResult<FaqPage>> => {
    const params = new URLSearchParams({ limit: '50' });
    if (query) params.set('q', query);
    return request<FaqPage>(`/api/line/admin/faq?${params}`, opts);
  },
  createFaq: (payload: FaqPayload): Promise<ApiResult<OkBody>> =>
    request<OkBody>('/api/line/admin/faq', withBody('POST', payload)),
  updateFaq: (id: string, payload: FaqPayload): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/faq/${id}`, withBody('PATCH', payload)),
  deleteFaq: (id: string): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/faq/${id}`, { method: 'DELETE' }),

  // ── Intents / หมวดหมู่เจตนา ──
  listIntents: (query = '', opts?: { signal?: AbortSignal }): Promise<ApiResult<ListOf<IntentItem>>> =>
    request<ListOf<IntentItem>>('/api/line/admin/intents', opts),
  getIntent: (id: string, opts?: { signal?: AbortSignal }): Promise<ApiResult<IntentItem>> =>
    request<IntentItem>(`/api/line/admin/intents/${id}`, opts),
  createIntent: (payload: IntentPayload): Promise<ApiResult<OkBody & { id?: string }>> =>
    request<OkBody & { id?: string }>('/api/line/admin/intents', withBody('POST', payload)),
  updateIntent: (id: string, payload: IntentPatch): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/intents/${id}`, withBody('PATCH', payload)),
  deleteIntent: (id: string): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/intents/${id}`, { method: 'DELETE' }),

  // ── Reply objects ──
  listReplyObjects: (query = '', opts?: { signal?: AbortSignal }): Promise<ApiResult<ListOf<ReplyObject>>> =>
    request<ListOf<ReplyObject>>('/api/line/admin/reply-objects', opts),
  createReplyObject: (payload: ReplyObjectInput): Promise<ApiResult<OkBody>> =>
    request<OkBody>('/api/line/admin/reply-objects', withBody('POST', payload)),
  updateReplyObject: (id: string, payload: ReplyObjectPatch): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/reply-objects/${id}`, withBody('PATCH', payload)),
  deleteReplyObject: (id: string): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/reply-objects/${id}`, { method: 'DELETE' }),

  // ── Rich menus ──
  listRichMenus: (query = '', opts?: { signal?: AbortSignal }): Promise<ApiResult<ListOf<RichMenuItem>>> =>
    request<ListOf<RichMenuItem>>('/api/line/admin/rich-menus', opts),
  getRichMenu: (id: string): Promise<ApiResult<RichMenuItemDetail>> =>
    request<RichMenuItemDetail>(`/api/line/admin/rich-menus/${id}`),
  createRichMenu: (payload: RichMenuInput): Promise<ApiResult<OkBody & { id?: string }>> =>
    request<OkBody & { id?: string }>('/api/line/admin/rich-menus', withBody('POST', payload)),
  updateRichMenu: (id: string, payload: RichMenuPatch): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/rich-menus/${id}`, withBody('PATCH', payload)),
  deleteRichMenu: (id: string): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/rich-menus/${id}`, { method: 'DELETE' }),
  getRichMenuInsightSummary: (
    id: string,
    from: string,
    to: string,
  ): Promise<ApiResult<RichMenuInsightSummary>> =>
    request<RichMenuInsightSummary>(
      `/api/line/admin/rich-menus/${id}/insights/summary?from=${from}&to=${to}`,
    ),
  getRichMenuInsightDaily: (
    id: string,
    from: string,
    to: string,
  ): Promise<ApiResult<RichMenuInsightDaily>> =>
    request<RichMenuInsightDaily>(
      `/api/line/admin/rich-menus/${id}/insights/daily?from=${from}&to=${to}`,
    ),
  syncRichMenu: (id: string): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/rich-menus/${id}/sync`, { method: 'POST' }),
  publishRichMenu: (id: string): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/rich-menus/${id}/publish`, { method: 'POST' }),
  listMenuAliases: (query = '', opts?: { signal?: AbortSignal }): Promise<ApiResult<ListOf<RichMenuAliasItem>>> =>
    request<ListOf<RichMenuAliasItem>>('/api/line/admin/rich-menus/aliases', opts),
  createMenuAlias: (aliasId: string, menuId: string): Promise<ApiResult<OkBody>> =>
    request<OkBody>('/api/line/admin/rich-menus/aliases', withBody('POST', { aliasId, menuId })),
  repointMenuAlias: (aliasId: string, menuId: string): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/rich-menus/aliases/${aliasId}`, withBody('PUT', { menuId })),
  deleteMenuAlias: (aliasId: string): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/rich-menus/aliases/${aliasId}`, { method: 'DELETE' }),
  uploadRichMenuImage: (id: string, file: File): Promise<ApiResult<OkBody>> => {
    const form = new FormData();
    form.append('file', file);
    return request<OkBody>(`/api/line/admin/rich-menus/${id}/upload`, { method: 'POST', body: form });
  },

  // ── Friends ──
  listFriends: (query: string, opts?: { signal?: AbortSignal }): Promise<ApiResult<FriendsPage>> =>
    request<FriendsPage>(`/api/line/admin/friends?${query}`, opts),
  getFriend: (id: string, opts?: { signal?: AbortSignal }): Promise<ApiResult<FriendItem>> =>
    request<FriendItem>(`/api/line/admin/friends/${id}`, opts),
  listFriendEvents: (friendId?: string, opts?: { signal?: AbortSignal }): Promise<ApiResult<ListOf<FriendEventItem>>> =>
    request<ListOf<FriendEventItem>>(
      `/api/line/admin/friend-events${friendId ? `?friendId=${encodeURIComponent(friendId)}` : ''}`,
      opts,
    ),
  assignUserRichMenu: (friendId: string, richMenuId: string): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/friends/${friendId}/rich-menu`, withBody('POST', { richMenuId })),
  unassignUserRichMenu: (friendId: string): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/friends/${friendId}/rich-menu`, { method: 'DELETE' }),

  // ── Broadcasts ──
  listBroadcasts: (query = '', opts?: { signal?: AbortSignal }): Promise<ApiResult<BroadcastPage>> =>
    request<BroadcastPage>(`/api/line/admin/broadcasts${query ? `?${query}` : ''}`, opts),
  getBroadcast: (id: string, opts?: { signal?: AbortSignal }): Promise<ApiResult<BroadcastItem>> =>
    request<BroadcastItem>(`/api/line/admin/broadcasts/${id}`, opts),
  createBroadcast: (payload: BroadcastInput): Promise<ApiResult<OkBody & { id?: string }>> =>
    request<OkBody & { id?: string }>('/api/line/admin/broadcasts', withBody('POST', payload)),
  sendBroadcast: (id: string): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/broadcasts/${id}/send`, { method: 'POST' }),
  /** ยกเลิกแบบ soft — API คืน 409 เมื่อสถานะส่งแล้ว/กำลังส่ง */
  cancelBroadcast: (id: string): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/broadcasts/${id}`, { method: 'DELETE' }),
  listBroadcastRecipients: (): Promise<ApiResult<ListOf<BroadcastRecipientOption>>> =>
    request<ListOf<BroadcastRecipientOption>>('/api/line/admin/broadcasts/recipients'),
  dryRunBroadcast: (target: BroadcastTarget): Promise<ApiResult<{ estimatedRecipients: number }>> =>
    request<{ estimatedRecipients: number }>('/api/line/admin/broadcasts/dry-run', withBody('POST', { target })),

  // ── Media ──
  listMedia: (query = '', opts?: { signal?: AbortSignal }): Promise<ApiResult<MediaPage>> => request<MediaPage>('/api/line/admin/media', opts),
  uploadMedia: (file: File, category = 'general'): Promise<ApiResult<UploadResult>> => {
    const form = new FormData();
    form.append('file', file);
    form.append('category', category);
    return request<UploadResult>('/api/line/admin/media', { method: 'POST', body: form });
  },
  deleteMedia: (id: string): Promise<ApiResult<OkBody>> =>
    request<OkBody>(`/api/line/admin/media/${id}`, { method: 'DELETE' }),

  // ── health / settings / stats ──
  getHealth: (query = '', opts?: { signal?: AbortSignal }): Promise<ApiResult<HealthData>> => request<HealthData>('/api/line/admin/health', opts),
  getSettings: (query = '', opts?: { signal?: AbortSignal }): Promise<ApiResult<SettingsData>> =>
    request<SettingsData>('/api/line/admin/settings', opts),
  saveSettings: (payload: SettingsInput): Promise<ApiResult<OkBody>> =>
    request<OkBody>('/api/line/admin/settings', withBody('PUT', payload)),
  getLineQuota: (query = '', opts?: { signal?: AbortSignal }): Promise<ApiResult<LineQuotaData>> =>
    request<LineQuotaData>('/api/line/admin/quota', opts),
  refreshLineQuota: (): Promise<ApiResult<LineQuotaData>> =>
    request<LineQuotaData>('/api/line/admin/quota?refresh=1'),
  getSystemSettings: (query = '', opts?: { signal?: AbortSignal }): Promise<ApiResult<SystemSettingsData>> =>
    request<SystemSettingsData>('/api/admin/system-settings', opts),
  saveSystemSettings: (payload: SystemSettingsInput): Promise<ApiResult<OkBody>> =>
    request<OkBody>('/api/admin/system-settings', withBody('PUT', payload)),
  listApiConnections: (query = '', opts?: { signal?: AbortSignal }): Promise<ApiResult<ListOf<ApiConnectionItem>>> =>
    request<ListOf<ApiConnectionItem>>('/api/admin/api-connections', opts),
  refreshApiConnection: (provider: string): Promise<ApiResult<OkBody>> =>
    request<OkBody>('/api/admin/api-connections', withBody('POST', { provider })),
  getChatbotStats: (): Promise<ApiResult<ChatbotStats>> =>
    request<ChatbotStats>('/api/line/admin/chatbot-stats'),
};
