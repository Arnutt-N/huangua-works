'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  User,
  Send,
  RefreshCw,
  CheckCircle,
  UserCheck,
  MessagesSquare,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { EmptyState } from '@/components/admin/empty-state';
import { cn } from '@/lib/cn';

interface Conversation {
  id: string;
  mode: string;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  lastMessageSender: string | null;
  unreadAdmin: number;
  displayName: string | null;
  lineUserId: string;
}

interface Message {
  id: string;
  sender: string;
  messageType: string;
  textContent: string | null;
  createdAt: string;
}

const MODE_LABELS: Record<string, string> = {
  bot_active: 'Bot ตอบอัตโนมัติ',
  waiting_handoff: 'รอเจ้าหน้าที่',
  human_active: 'เจ้าหน้าที่ตอบ',
  resolved: 'ปิดเรื่อง',
};

/**
 * § สีโหมดสนทนา — ใช้ design token เท่านั้น
 * ของเดิมเป็นสี Tailwind ดิบ (bg-blue-100/bg-green-600/bg-purple-50/bg-gray-100) ซึ่ง
 *   (ก) ไม่อยู่ในพาเลต emerald+amber ของระบบเลย หน้านี้จึงดูหลุดจากหน้าอื่นทั้งหมด
 *   (ข) ไม่ตอบสนอง dark theme เพราะเป็นค่าคงที่
 * แมปใหม่: emerald = ระบบ/บอท, amber = รอคน, success = คนกำลังคุย, muted = ปิดแล้ว
 */
const MODE_BADGE: Record<string, string> = {
  bot_active: 'bg-accent-sunken text-accent-strong ring-accent-strong/20',
  waiting_handoff: 'bg-warning-soft text-warning-ink ring-warning-ink/20',
  human_active: 'bg-success-soft text-success-ink ring-success-ink/20',
  resolved: 'bg-surface-sunken text-muted ring-border-strong/30',
};

const FALLBACK_BADGE = 'bg-surface-sunken text-muted ring-border-strong/30';

export function ChatClient({ adminUserId }: { adminUserId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string>('bot_active');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch('/api/line/admin/conversations');
    if (res.ok) setConversations(await res.json());
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    const res = await fetch(`/api/line/admin/conversations/${id}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages);
      setSelectedMode(data.conversation.mode);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch conversations on mount; loadConversations is also reused by the SSE handler and manual refresh below, so it can't be inlined
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const es = new EventSource('/api/line/admin/sse');
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      let event: { type?: string; conversationId?: string; payload?: { mode?: string } & Record<string, unknown> };
      try {
        event = JSON.parse(e.data);
      } catch {
        return;
      }
      if (event.type === 'connected') return;

      if (event.type === 'new_message') {
        if (event.conversationId === selectedId) {
          setMessages((prev) => [...prev, event.payload as unknown as Message]);
        }
        loadConversations();
      }
      if (event.type === 'mode_change' || event.type === 'conversation_update') {
        loadConversations();
        if (event.conversationId === selectedId && event.payload?.mode) {
          setSelectedMode(event.payload.mode);
        }
      }
    };

    return () => es.close();
  }, [selectedId, loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    loadMessages(id);
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedId) return;
    setSending(true);
    try {
      await fetch(`/api/line/admin/conversations/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input.trim() }),
      });
      setInput('');
      await loadMessages(selectedId);
    } finally {
      setSending(false);
    }
  };

  const handleModeChange = async (mode: string) => {
    if (!selectedId) return;
    await fetch(`/api/line/admin/conversations/${selectedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    setSelectedMode(mode);
    loadConversations();
  };

  const canReply = selectedMode === 'human_active';

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="glass-panel flex h-[calc(100dvh-13rem)] min-h-[28rem] overflow-hidden rounded-xl shadow-sm">
        {/* ── รายการสนทนา ──
             มือถือ: แสดงเต็มความกว้าง แล้วสลับไปหน้าต่างแชทเมื่อเลือกห้อง
             (ของเดิมตรึง w-72 ทุกจอ ทำให้บนมือถือเหลือที่แชทไม่ถึงครึ่งจอ) */}
        <div
          className={cn(
            'flex-col border-r border-border sm:flex sm:w-72 sm:flex-none',
            selectedId ? 'hidden' : 'flex w-full',
          )}
        >
          <div className="flex items-center gap-2 border-b border-border bg-surface-sunken/60 px-4 py-3">
            <MessagesSquare className="h-4 w-4 flex-none text-accent-strong" aria-hidden="true" />
            <h2 className="truncate text-sm font-bold text-ink">การสนทนา LINE</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted">ยังไม่มีการสนทนา</p>
            ) : (
              conversations.map((conv) => {
                const isSelected = selectedId === conv.id;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleSelect(conv.id)}
                    aria-current={isSelected ? 'true' : undefined}
                    className={cn(
                      'flex w-full flex-col gap-1.5 border-b border-l-4 border-border px-3 py-3 text-left',
                      'transition-colors duration-normal ease-out-expo',
                      isSelected
                        ? 'border-l-accent-strong bg-accent-sunken'
                        : 'border-l-transparent hover:bg-accent-sunken/50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">
                        {conv.displayName ?? conv.lineUserId.slice(0, 8)}
                      </span>
                      {conv.unreadAdmin > 0 && (
                        <span className="flex h-5 min-w-5 flex-none items-center justify-center rounded-pill bg-accent-strong px-1.5 text-[10px] font-bold text-on-accent">
                          {conv.unreadAdmin}
                        </span>
                      )}
                    </div>
                    <span className="truncate text-xs text-muted">
                      {conv.lastMessageText ?? '—'}
                    </span>
                    <span
                      className={cn(
                        'inline-block w-fit rounded-pill px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                        MODE_BADGE[conv.mode] ?? FALLBACK_BADGE,
                      )}
                    >
                      {MODE_LABELS[conv.mode] ?? conv.mode}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── หน้าต่างแชท ── */}
        <div
          className={cn(
            'min-w-0 flex-1 flex-col sm:flex',
            selectedId ? 'flex' : 'hidden',
          )}
        >
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={MessagesSquare}
                title="เลือกการสนทนา"
                description="เลือกรายการจากด้านซ้ายเพื่อดูข้อความและตอบกลับผู้ใช้ LINE"
              />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-sunken/60 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="inline-flex min-h-touch items-center gap-1 text-sm font-medium text-muted hover:text-accent-strong sm:hidden"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  รายการ
                </button>
                <span
                  className={cn(
                    'rounded-pill px-3 py-1 text-xs font-semibold ring-1 ring-inset',
                    MODE_BADGE[selectedMode] ?? FALLBACK_BADGE,
                  )}
                >
                  {MODE_LABELS[selectedMode] ?? selectedMode}
                </span>
                <div className="flex flex-wrap gap-2">
                  {selectedMode !== 'human_active' && selectedMode !== 'resolved' && (
                    <Button type="button" size="sm" onClick={() => handleModeChange('human_active')}>
                      <UserCheck className="h-4 w-4" aria-hidden="true" />
                      รับเรื่อง
                    </Button>
                  )}
                  {selectedMode === 'human_active' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleModeChange('resolved')}
                    >
                      <CheckCircle className="h-4 w-4" aria-hidden="true" />
                      ปิดเรื่อง
                    </Button>
                  )}
                  {selectedMode === 'resolved' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleModeChange('bot_active')}
                    >
                      <Bot className="h-4 w-4" aria-hidden="true" />
                      คืนให้ Bot
                    </Button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.map((msg) => {
                  const isAdmin = msg.sender === 'admin';
                  const isBot = msg.sender === 'bot';
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex items-start gap-2',
                        isAdmin ? 'flex-row-reverse' : 'flex-row',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-7 w-7 flex-none items-center justify-center rounded-full ring-1 ring-inset',
                          isAdmin
                            ? 'bg-success-soft text-success-ink ring-success-ink/20'
                            : isBot
                              ? 'bg-accent-sunken text-accent-strong ring-accent-strong/20'
                              : 'bg-surface-sunken text-muted ring-border-strong/30',
                        )}
                        aria-hidden="true"
                      >
                        {isAdmin ? (
                          <UserCheck className="h-3.5 w-3.5" />
                        ) : isBot ? (
                          <Bot className="h-3.5 w-3.5" />
                        ) : (
                          <User className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div
                        className={cn(
                          'max-w-[70%] rounded-xl px-3.5 py-2 text-sm',
                          isAdmin
                            ? 'bg-accent-strong text-on-accent'
                            : isBot
                              ? 'border border-accent-strong/20 bg-accent-sunken text-ink'
                              : 'border border-border bg-surface-sunken text-ink',
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {msg.textContent ?? `[${msg.messageType}]`}
                        </p>
                        <p
                          className={cn(
                            'mt-1 text-[10px]',
                            isAdmin ? 'text-on-accent/75' : 'text-muted',
                          )}
                        >
                          {new Date(msg.createdAt).toLocaleTimeString('th-TH', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border p-3">
                <div className="flex gap-2">
                  <Input
                    aria-label="พิมพ์ข้อความ"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder={canReply ? 'พิมพ์ข้อความ...' : 'รับเรื่องก่อนเพื่อตอบผู้ใช้'}
                    disabled={!canReply}
                    className="flex-1 disabled:bg-surface-sunken"
                  />
                  <Button
                    type="button"
                    onClick={handleSend}
                    disabled={sending || !input.trim() || !canReply}
                    aria-label="ส่งข้อความ"
                    className="px-4"
                  >
                    {sending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
