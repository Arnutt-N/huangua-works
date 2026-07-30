'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchConversationPage, patchConversation, sendReply } from '../_lib/api';
import type { ConversationDetail, Message } from '../_lib/types';

/**
 * state + logic ของห้องแชทที่เปิดอยู่ — optimistic send / retry / dedup / mode change
 * (ย้ายมาจาก chat-client.tsx เดิมแบบ verbatim — semantics เดิมทุกอย่าง)
 */
export function useMessages(loadConversations: () => void) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [selectedMode, setSelectedMode] = useState<string>('bot_active');
  const [actionError, setActionError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const loadingOlderRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const loadMessages = useCallback(async (id: string) => {
    const data = await fetchConversationPage(id);
    if (data) {
      setMessages(data.messages);
      setDetail(data.conversation);
      setSelectedMode(data.conversation.mode);
      setHasMore(data.hasMore);
    }
  }, []);

  // cursor paging ย้อนหลัง — prepend หน้าเก่าโดยไม่แตะข้อความล่าสุด
  const loadOlder = useCallback(async (id: string) => {
    if (loadingOlderRef.current) return;
    loadingOlderRef.current = true;
    try {
      // cursor = ข้อความจริงที่เก่าสุด (ข้าม optimistic bubble ที่ id ยังเป็น temp-)
      const before = messagesRef.current.find((m) => !m.id.startsWith('temp-'))?.id;
      if (!before) return;
      const data = await fetchConversationPage(id, { before });
      if (data) {
        setMessages((prev) => [...data.messages, ...prev]);
        setHasMore(data.hasMore);
      }
    } finally {
      loadingOlderRef.current = false;
    }
  }, []);

  const applyIncoming = useCallback((incoming: Message) => {
    setMessages((prev) => {
      // dedup 2 ทาง: id (event ซ้ำ) + clientTempId (แทนที่ optimistic bubble)
      const matches = (m: Message) =>
        m.id === incoming.id ||
        Boolean(incoming.clientTempId && m.clientTempId === incoming.clientTempId);
      if (prev.some(matches)) {
        return prev.map((m) => (matches(m) ? { ...incoming, status: undefined } : m));
      }
      return [...prev, incoming];
    });
  }, []);

  const deliverMessage = useCallback(
    async (conversationId: string, text: string, tempId: string) => {
      const markFailed = () =>
        setMessages((prev) =>
          prev.map((m) => (m.clientTempId === tempId ? { ...m, status: 'failed' as const } : m)),
        );
      try {
        const { ok, data } = await sendReply(conversationId, text, tempId);
        if (!ok) {
          markFailed();
          setActionError(data?.error ?? 'ส่งข้อความไม่สำเร็จ');
          return;
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.clientTempId === tempId
              ? { ...m, id: data?.messageId ?? m.id, status: undefined }
              : m,
          ),
        );
        loadConversations();
      } catch {
        markFailed();
        setActionError('ส่งข้อความไม่สำเร็จ — ตรวจสอบการเชื่อมต่อ');
      }
    },
    [loadConversations],
  );

  const send = useCallback(
    (conversationId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      setActionError(null);
      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          sender: 'admin',
          messageType: 'text',
          textContent: trimmed,
          createdAt: new Date().toISOString(),
          clientTempId: tempId,
          status: 'pending',
        },
      ]);
      void deliverMessage(conversationId, trimmed, tempId);
    },
    [deliverMessage],
  );

  // retry ปลอดภัยเพราะ server dedup ด้วย clientTempId เดิม — ไม่ push ซ้ำหาลูกค้า
  const retry = useCallback(
    (conversationId: string, msg: Message) => {
      if (!msg.clientTempId || !msg.textContent) return;
      setActionError(null);
      setMessages((prev) =>
        prev.map((m) =>
          m.clientTempId === msg.clientTempId ? { ...m, status: 'pending' as const } : m,
        ),
      );
      void deliverMessage(conversationId, msg.textContent, msg.clientTempId);
    },
    [deliverMessage],
  );

  const changeMode = useCallback(
    async (conversationId: string, mode: string) => {
      setActionError(null);
      const result = await patchConversation(conversationId, { mode });
      if (result.ok) {
        setSelectedMode(mode);
      } else {
        setActionError(result.error ?? 'เปลี่ยนโหมดไม่สำเร็จ');
        // sync สถานะจริงจาก server (เช่น แพ้ race รับเรื่อง → เห็นว่าใครถืออยู่)
        loadMessages(conversationId);
      }
      loadConversations();
    },
    [loadConversations, loadMessages],
  );

  // โอนแชท / รับช่วงต่อ — server guard: ต้อง human_active เท่านั้น
  const transfer = useCallback(
    async (conversationId: string, toAdminId: string, reason?: string) => {
      setActionError(null);
      const result = await patchConversation(conversationId, {
        assignedAdminId: toAdminId,
        ...(reason ? { transferReason: reason } : {}),
      });
      if (!result.ok) {
        setActionError(result.error ?? 'โอนแชทไม่สำเร็จ');
      }
      loadMessages(conversationId);
      loadConversations();
      return result.ok;
    },
    [loadConversations, loadMessages],
  );

  return {
    messages,
    detail,
    setDetail,
    selectedMode,
    setSelectedMode,
    actionError,
    setActionError,
    hasMore,
    loadMessages,
    loadOlder,
    applyIncoming,
    send,
    retry,
    changeMode,
    transfer,
  };
}
