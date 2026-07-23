'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, User, Send, RefreshCw, CheckCircle, UserCheck } from 'lucide-react';
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

const MODE_COLORS: Record<string, string> = {
  bot_active: 'bg-blue-100 text-blue-800',
  waiting_handoff: 'bg-yellow-100 text-yellow-800',
  human_active: 'bg-green-100 text-green-800',
  resolved: 'bg-gray-100 text-gray-600',
};

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
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const es = new EventSource('/api/line/admin/sse');
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.type === 'connected') return;

      if (event.type === 'new_message') {
        if (event.conversationId === selectedId) {
          setMessages((prev) => [...prev, event.payload]);
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

  return (
    <div className="mx-auto flex h-[calc(100vh-120px)] max-w-6xl gap-0 overflow-hidden border border-border bg-surface">
      {/* Conversation list */}
      <div className="w-72 flex-shrink-0 overflow-y-auto border-r border-border">
        <div className="border-b border-border p-3">
          <h2 className="text-sm font-bold text-ink">การสนทนา LINE</h2>
        </div>
        {conversations.length === 0 && (
          <p className="p-4 text-center text-sm text-muted">ยังไม่มีการสนทนา</p>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => handleSelect(conv.id)}
            className={cn(
              'flex w-full flex-col gap-1 border-b border-border px-3 py-2.5 text-left transition-colors hover:bg-muted/50',
              selectedId === conv.id && 'bg-accent/5 border-l-2 border-l-accent',
            )}
          >
            <div className="flex items-center justify-between">
              <span className="truncate text-sm font-semibold text-ink">
                {conv.displayName ?? conv.lineUserId.slice(0, 8)}
              </span>
              {conv.unreadAdmin > 0 && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                  {conv.unreadAdmin}
                </span>
              )}
            </div>
            <span className="truncate text-xs text-muted">{conv.lastMessageText ?? '—'}</span>
            <span className={cn('inline-block w-fit rounded px-1.5 py-0.5 text-[10px] font-medium', MODE_COLORS[conv.mode])}>
              {MODE_LABELS[conv.mode]}
            </span>
          </button>
        ))}
      </div>

      {/* Chat window */}
      <div className="flex flex-1 flex-col">
        {!selectedId ? (
          <div className="flex flex-1 items-center justify-center text-muted">
            <p>เลือกการสนทนาจากด้านซ้าย</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className={cn('rounded px-2 py-1 text-xs font-medium', MODE_COLORS[selectedMode])}>
                {MODE_LABELS[selectedMode]}
              </span>
              <div className="flex gap-1">
                {selectedMode !== 'human_active' && selectedMode !== 'resolved' && (
                  <button
                    onClick={() => handleModeChange('human_active')}
                    className="flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                  >
                    <UserCheck className="h-3 w-3" /> รับเรื่อง
                  </button>
                )}
                {selectedMode === 'human_active' && (
                  <button
                    onClick={() => handleModeChange('resolved')}
                    className="flex items-center gap-1 rounded bg-gray-600 px-2 py-1 text-xs font-medium text-white hover:bg-gray-700"
                  >
                    <CheckCircle className="h-3 w-3" /> ปิดเรื่อง
                  </button>
                )}
                {selectedMode === 'resolved' && (
                  <button
                    onClick={() => handleModeChange('bot_active')}
                    className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    <Bot className="h-3 w-3" /> คืนให้ Bot
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex items-start gap-2',
                    msg.sender === 'admin' ? 'flex-row-reverse' : 'flex-row',
                  )}
                >
                  <div className={cn(
                    'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full',
                    msg.sender === 'user' ? 'bg-blue-100' : msg.sender === 'bot' ? 'bg-purple-100' : 'bg-green-100',
                  )}>
                    {msg.sender === 'user' ? <User className="h-3 w-3 text-blue-600" /> :
                     msg.sender === 'bot' ? <Bot className="h-3 w-3 text-purple-600" /> :
                     <UserCheck className="h-3 w-3 text-green-600" />}
                  </div>
                  <div className={cn(
                    'max-w-[70%] rounded-lg px-3 py-2 text-sm',
                    msg.sender === 'admin'
                      ? 'bg-green-600 text-white'
                      : msg.sender === 'bot'
                        ? 'bg-purple-50 text-purple-900 border border-purple-200'
                        : 'bg-gray-100 text-ink',
                  )}>
                    <p className="whitespace-pre-wrap">{msg.textContent ?? `[${msg.messageType}]`}</p>
                    <p className={cn('mt-1 text-[10px]', msg.sender === 'admin' ? 'text-green-200' : 'text-muted')}>
                      {new Date(msg.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-3">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder={selectedMode === 'human_active' ? 'พิมพ์ข้อความ...' : 'รับเรื่องก่อนเพื่อตอบผู้ใช้'}
                  disabled={selectedMode !== 'human_active'}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent disabled:bg-muted/50 disabled:text-muted"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !input.trim() || selectedMode !== 'human_active'}
                  className="flex items-center justify-center rounded-lg bg-accent px-3 py-2 text-white disabled:opacity-50"
                >
                  {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
