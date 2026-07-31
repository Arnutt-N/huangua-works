'use client';

import { AlertCircle, Bot, CheckCheck, RefreshCw, User, UserCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatTime } from '../_lib/format';
import type { Message } from '../_lib/types';
import { LineAvatar } from './line-avatar';

const SENDER_LABELS: Record<string, string> = {
  admin: 'เจ้าหน้าที่',
  bot: 'บอท',
};

export function MessageBubble({
  message: msg,
  customerName,
  customerPicture,
  showSender = true,
  showAvatar = true,
  onRetry,
}: {
  message: Message;
  customerName: string | null;
  customerPicture: string | null;
  /** ข้อความแรกของชุด — โชว์ชื่อผู้ส่ง */
  showSender?: boolean;
  /** ข้อความสุดท้ายของชุด — โชว์ avatar (ตาม jsk avatar อยู่ล่างสุดของชุด) */
  showAvatar?: boolean;
  onRetry: (msg: Message) => void;
}) {
  const isAdmin = msg.sender === 'admin';
  const isBot = msg.sender === 'bot';
  // ฝั่งขวา = ข้อความที่ออกจากเรา (เจ้าหน้าที่ + บอทตอบแทนเรา), ฝั่งซ้าย = ลูกค้า
  const outgoing = isAdmin || isBot;
  const senderLabel = SENDER_LABELS[msg.sender] ?? customerName ?? 'ผู้ใช้ LINE';

  const avatar = !showAvatar ? (
    <span className="h-7 w-7 flex-none" aria-hidden="true" />
  ) : outgoing ? (
    <span
      className={cn(
        'inline-flex h-7 w-7 flex-none items-center justify-center rounded-pill',
        isAdmin ? 'bg-success-soft text-success-ink' : 'bg-accent-sunken text-accent-strong',
      )}
      aria-hidden="true"
    >
      {isAdmin ? <UserCheck className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
    </span>
  ) : (
    <LineAvatar
      src={customerPicture}
      className="h-7 w-7 flex-none rounded-pill object-cover"
      fallback={
        <span
          className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-pill bg-surface-sunken text-muted"
          aria-hidden="true"
        >
          <User className="h-3.5 w-3.5" />
        </span>
      }
    />
  );

  return (
    <div
      className={cn(
        'flex items-end gap-2',
        outgoing ? 'justify-end' : 'justify-start',
        msg.status === 'pending' && 'opacity-60',
      )}
    >
      {!outgoing && avatar}
      <div
        className={cn(
          'flex max-w-[65%] flex-col gap-0.5',
          outgoing ? 'items-end' : 'items-start',
        )}
      >
        {showSender && (
          <span
            className={cn(
              'px-1 text-[10px] font-medium',
              isAdmin ? 'text-success-ink' : isBot ? 'text-accent-strong' : 'text-muted',
            )}
          >
            {senderLabel}
          </span>
        )}
        <div
          className={cn(
            'relative whitespace-pre-wrap break-words rounded-lg px-4 py-2.5 text-sm leading-relaxed shadow-sm',
            isAdmin
              ? 'bg-accent-gradient text-on-accent'
              : isBot
                ? 'border border-accent-strong/20 bg-accent-sunken text-ink'
                : 'border border-border bg-surface-raised text-ink',
          )}
        >
          {msg.textContent ?? `[${msg.messageType}]`}
        </div>
        <span className="flex items-center gap-1 px-1 text-[10px] text-muted">
          {msg.status === 'pending' ? (
            <>
              <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
              กำลังส่ง...
            </>
          ) : msg.status === 'failed' ? (
            <button
              type="button"
              onClick={() => onRetry(msg)}
              className="inline-flex items-center gap-1 font-semibold text-danger underline underline-offset-2"
            >
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              ส่งไม่สำเร็จ — ลองอีกครั้ง
            </button>
          ) : (
            <>
              <span className="tabular-nums">{formatTime(msg.createdAt)}</span>
              {isAdmin && <CheckCheck className="h-3 w-3 text-accent-strong" aria-hidden="true" />}
            </>
          )}
        </span>
      </div>
      {outgoing && avatar}
    </div>
  );
}
