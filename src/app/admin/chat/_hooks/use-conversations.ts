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

  const counts = useMemo(
    () => ({
      all: conversations.length,
      waiting: conversations.filter((c) => c.mode === 'waiting_handoff').length,
      active: conversations.filter((c) => c.mode === 'human_active').length,
    }),
    [conversations],
  );

  const visible = useMemo(() => {
    let list = conversations;
    if (filter === 'waiting') list = list.filter((c) => c.mode === 'waiting_handoff');
    if (filter === 'active') list = list.filter((c) => c.mode === 'human_active');

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          (c.displayName ?? '').toLowerCase().includes(q) ||
          c.lineUserId.toLowerCase().includes(q),
      );
    }

    const time = (c: Conversation) => (c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : 0);
    return [...list].sort((a, b) => {
      // pin ก่อนเสมอ
      if ((a.pinned ?? false) !== (b.pinned ?? false)) return a.pinned ? -1 : 1;
      return sort === 'newest' ? time(b) - time(a) : time(a) - time(b);
    });
  }, [conversations, filter, query, sort]);

  return {
    conversations,
    visible,
    counts,
    loading,
    feedback,
    filter,
    setFilter,
    sort,
    setSort,
    query,
    setQuery,
    loadConversations,
    togglePref,
    markReadLocal,
  };
}
