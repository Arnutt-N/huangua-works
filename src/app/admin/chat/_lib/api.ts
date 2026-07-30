import type {
  CannedResponse,
  ChatTag,
  Conversation,
  ConversationDetail,
  Message,
  MessageSearchResult,
  StaffMember,
} from './types';

/**
 * typed fetch helpers — ทุก endpoint ของหน้าแชทรวมที่นี่
 * คืน null เมื่อ response ไม่ ok (caller ตัดสินใจ error handling เอง)
 */

async function jsonOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}

export async function fetchConversations(): Promise<Conversation[] | null> {
  const res = await fetch('/api/line/admin/conversations');
  return jsonOrNull<Conversation[]>(res);
}

export interface ConversationPage {
  conversation: ConversationDetail;
  messages: Message[];
  hasMore: boolean;
}

export async function fetchConversationPage(
  id: string,
  opts?: { before?: string; limit?: number },
): Promise<ConversationPage | null> {
  const params = new URLSearchParams();
  if (opts?.before) params.set('before', opts.before);
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.size > 0 ? `?${params}` : '';
  const res = await fetch(`/api/line/admin/conversations/${id}${qs}`);
  return jsonOrNull<ConversationPage>(res);
}

export function markConversationRead(id: string): void {
  void fetch(`/api/line/admin/conversations/${id}/read`, { method: 'POST' });
}

export interface ApiResult {
  ok: boolean;
  error?: string;
  messageId?: string;
}

export async function sendReply(
  conversationId: string,
  text: string,
  clientTempId: string,
): Promise<{ ok: boolean; data: ApiResult | null }> {
  const res = await fetch(`/api/line/admin/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, clientTempId }),
  });
  return { ok: res.ok, data: await res.json().catch(() => null) };
}

export async function patchConversation(
  id: string,
  body: {
    mode?: string;
    linkedCaseId?: string | null;
    assignedAdminId?: string;
    transferReason?: string;
    adminNote?: string | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/line/admin/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true };
  const data: { error?: string } | null = await res.json().catch(() => null);
  return { ok: false, error: data?.error };
}

// ── ค้นหาข้อความ ──

export async function searchMessages(q: string): Promise<MessageSearchResult[]> {
  const res = await fetch(`/api/line/admin/search?q=${encodeURIComponent(q)}`);
  const data = await jsonOrNull<{ items: MessageSearchResult[] }>(res);
  return data?.items ?? [];
}

// ── prefs (pin/mute) — per-admin ──

export async function putPrefs(
  conversationId: string,
  prefs: { pinned?: boolean; muted?: boolean },
): Promise<boolean> {
  const res = await fetch(`/api/line/admin/conversations/${conversationId}/prefs`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  });
  return res.ok;
}

// ── canned responses ──

export async function fetchCannedResponses(): Promise<CannedResponse[]> {
  const res = await fetch('/api/line/admin/canned-responses');
  return (await jsonOrNull<CannedResponse[]>(res)) ?? [];
}

export async function createCannedResponse(body: {
  title: string;
  shortcut?: string;
  content: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/line/admin/canned-responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true };
  const data: { error?: string } | null = await res.json().catch(() => null);
  return { ok: false, error: data?.error };
}

export async function updateCannedResponse(
  id: string,
  body: { title?: string; shortcut?: string; content?: string },
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/line/admin/canned-responses/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true };
  const data: { error?: string } | null = await res.json().catch(() => null);
  return { ok: false, error: data?.error };
}

export async function deleteCannedResponse(id: string): Promise<boolean> {
  const res = await fetch(`/api/line/admin/canned-responses/${id}`, { method: 'DELETE' });
  return res.ok;
}

// ── tags ──

export async function fetchTags(): Promise<ChatTag[]> {
  const res = await fetch('/api/line/admin/tags');
  return (await jsonOrNull<ChatTag[]>(res)) ?? [];
}

export async function createTag(body: {
  name: string;
  color: string;
}): Promise<{ ok: boolean; tag?: ChatTag; error?: string }> {
  const res = await fetch('/api/line/admin/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (res.ok) return { ok: true, tag: data as ChatTag };
  return { ok: false, error: (data as { error?: string } | null)?.error };
}

export async function putConversationTags(
  conversationId: string,
  tagIds: string[],
): Promise<boolean> {
  const res = await fetch(`/api/line/admin/conversations/${conversationId}/tags`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tagIds }),
  });
  return res.ok;
}

// ── staff (สำหรับโอนแชท) ──

export async function fetchStaff(): Promise<StaffMember[]> {
  const res = await fetch('/api/line/admin/staff');
  return (await jsonOrNull<StaffMember[]>(res)) ?? [];
}
