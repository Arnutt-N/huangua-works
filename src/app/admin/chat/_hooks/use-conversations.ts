'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchConversations, putPrefs } from '../_lib/api';
import type { Conversation } from '../_lib/types';

export type ConversationFilter = 'all' | 'waiting' | 'active';
export type ConversationSort = 'newest' | 'oldest';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [sort, setSort] = useState<ConversationSort>('newest');
  const [query, setQuery] = useState('');

  const loadConversations = useCallback(async () => {
    const data = await fetchConversations();
    if (data) setConversations(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; loadConversations ถูกใช้ซ้ำโดย SSE handler จึง inline ไม่ได้
    loadConversations();
  }, [loadConversations]);

  // pin/mute — optimistic แล้วค่อย sync; พลาดก็ revert ด้วย refetch
  const togglePref = useCallback(
    (id: string, patch: { pinned?: boolean; muted?: boolean }) => {
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      void putPrefs(id, patch).then((ok) => {
        if (!ok) loadConversations();
      });
    },
    [loadConversations],
  );

  // เคลียร์ unread ทันทีตอนเปิดห้อง — ไม่รอ broadcast กลับมา
  const markReadLocal = useCallback((id: string) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadAdmin: 0 } : c)));
  }, []);

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
