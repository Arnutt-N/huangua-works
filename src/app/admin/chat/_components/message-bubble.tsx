'use client';

import { Bot, User, UserCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatTime } from '../_lib/format';
import type { Message } from '../_lib/types';

export function MessageBubble({
  message: msg,
  grouped = false,
  onRetry,
}: {
  message: Message;
  grouped?: boolean;
  onRetry: (msg: Message) => void;
}) {
  const isAdmin = msg.sender === 'admin';
  const isBot = msg.sender === 'bot';
  return (
    <div
      className={cn(
        'flex items-start gap-2',
        isAdmin ? 'flex-row-reverse' : 'flex-row',
        msg.status === 'pending' && 'opacity-60',
      )}
    >
      {grouped ? (
        <span className="h-7 w-7 flex-none" aria-hidden="true" />
      ) : (
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
      )}
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
        <p className={cn('mt-1 text-[10px]', isAdmin ? 'text-on-accent/75' : 'text-muted')}>
          {msg.status === 'pending' ? 'กำลังส่ง...' : formatTime(msg.createdAt)}
        </p>
        {msg.status === 'failed' && (
          <button
            type="button"
            onClick={() => onRetry(msg)}
            className={cn(
              'mt-1 text-[11px] font-semibold underline underline-offset-2',
              isAdmin ? 'text-on-accent' : 'text-danger',
            )}
          >
            ส่งไม่สำเร็จ — ลองอีกครั้ง
          </button>
        )}
      </div>
    </div>
  );
}
