'use client';

import { useEffect, useRef } from 'react';
import { formatDateSeparator } from '../_lib/format';
import type { Message } from '../_lib/types';
import { MessageBubble } from './message-bubble';

const GROUP_WINDOW_MS = 5 * 60 * 1000;

function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function MessageList({
  messages,
  hasMore,
  onLoadOlder,
  onRetry,
}: {
  messages: Message[];
  hasMore: boolean;
  onLoadOlder: () => void;
  onRetry: (msg: Message) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const prevHeightRef = useRef(0);
  const prevCountRef = useRef(0);
  const prevFirstIdRef = useRef<string | null>(null);

  // autoscroll เฉพาะเมื่อผู้ใช้อยู่ใกล้ล่าง — ไม่ลากคนที่กำลังอ่านย้อนหลังลงมา
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const firstId = messages[0]?.id ?? null;
    const prepended =
      prevFirstIdRef.current !== null &&
      firstId !== prevFirstIdRef.current &&
      messages.length > prevCountRef.current;

    if (prepended) {
      // โหลดหน้าเก่า — คง scroll position เดิม (ชดเชยความสูงที่เพิ่ม)
      el.scrollTop += el.scrollHeight - prevHeightRef.current;
    } else if (stickToBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevHeightRef.current = el.scrollHeight;
    prevCountRef.current = messages.length;
    prevFirstIdRef.current = firstId;
  }, [messages]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    prevHeightRef.current = el.scrollHeight;
  };

  // เลื่อนขึ้นถึง sentinel → โหลดหน้าเก่ากว่า
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = containerRef.current;
    if (!sentinel || !root || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadOlder();
      },
      { root, rootMargin: '80px 0px 0px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadOlder]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 space-y-3 overflow-y-auto p-4"
      aria-live="polite"
      aria-label="ข้อความในการสนทนา"
    >
      {hasMore && (
        <div ref={sentinelRef} className="py-1 text-center text-[11px] text-muted">
          กำลังโหลดข้อความก่อนหน้า...
        </div>
      )}
      {messages.map((msg, i) => {
        const prev = messages[i - 1];
        const showDate = !prev || !sameDay(prev.createdAt, msg.createdAt);
        // ข้อความติดกันจากคนเดิมภายใน ≤5 นาที → ซ่อน avatar ให้อ่านเป็นกลุ่ม
        const grouped =
          !showDate &&
          !!prev &&
          prev.sender === msg.sender &&
          new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() <=
            GROUP_WINDOW_MS;
        return (
          <div key={msg.id} className="space-y-3">
            {showDate && (
              <div className="flex items-center gap-3 py-1" role="separator">
                <span className="h-px flex-1 bg-border" />
                <span className="rounded-pill bg-surface-sunken px-2.5 py-0.5 text-[10px] font-semibold text-muted">
                  {formatDateSeparator(msg.createdAt)}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            <MessageBubble message={msg} grouped={grouped} onRetry={onRetry} />
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
