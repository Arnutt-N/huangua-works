'use client';

import { memo } from 'react';
import { BellOff, MoreHorizontal, Pin } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatRelativeTime } from '../_lib/format';
import { FALLBACK_BADGE, MODE_BADGE, MODE_LABELS, TAG_BADGE } from '../_lib/labels';
import type { Conversation } from '../_lib/types';

export const ConversationItem = memo(function ConversationItem({
  conversation: conv,
  isSelected,
  onSelect,
  onTogglePin,
  onToggleMute,
  onMarkRead,
}: {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onToggleMute: (id: string, muted: boolean) => void;
  onMarkRead: (id: string) => void;
}) {
  const pinned = conv.pinned ?? false;
  const muted = conv.muted ?? false;

  return (
    <div
      className={cn(
        'group relative border-b border-l-4 border-border',
        'transition-colors duration-normal ease-out-expo',
        isSelected
          ? 'border-l-accent-strong bg-accent-sunken'
          : 'border-l-transparent hover:bg-accent-sunken/50',
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(conv.id)}
        aria-current={isSelected ? 'true' : undefined}
        className="flex w-full flex-col gap-1.5 px-3 py-3 pr-10 text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            {pinned && (
              <Pin className="h-3 w-3 flex-none text-accent-strong" aria-label="ปักหมุด" />
            )}
            {muted && (
              <BellOff className="h-3 w-3 flex-none text-muted" aria-label="ปิดการแจ้งเตือน" />
            )}
            <span className="truncate text-sm font-semibold text-ink">
              {conv.displayName ?? conv.lineUserId}
            </span>
          </span>
          <span className="flex flex-none items-center gap-1.5">
            <span className="text-[10px] text-muted">
              {formatRelativeTime(conv.lastMessageAt)}
            </span>
            {conv.unreadAdmin > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-pill bg-accent-strong px-1.5 text-[10px] font-bold text-on-accent">
                {conv.unreadAdmin > 9 ? '9+' : conv.unreadAdmin}
              </span>
            )}
          </span>
        </div>
        <span className="truncate text-xs text-muted">{conv.lastMessageText ?? '—'}</span>
        <span className="flex flex-wrap items-center gap-1">
          <span
            className={cn(
              'inline-block w-fit rounded-pill px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
              MODE_BADGE[conv.mode] ?? FALLBACK_BADGE,
            )}
          >
            {MODE_LABELS[conv.mode] ?? conv.mode}
          </span>
          {(conv.tags ?? []).map((tag) => (
            <span
              key={tag.id}
              className={cn(
                'inline-block rounded-pill px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset',
                TAG_BADGE[tag.color] ?? TAG_BADGE.muted,
              )}
            >
              {tag.name}
            </span>
          ))}
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`ตัวเลือกของ ${conv.displayName ?? conv.lineUserId}`}
          className={cn(
            'absolute right-1.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted',
            'opacity-0 transition-opacity duration-fast focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100',
            'hover:bg-accent-sunken hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong',
          )}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onTogglePin(conv.id, !pinned)}>
            <Pin className="h-4 w-4" aria-hidden="true" />
            {pinned ? 'เลิกปักหมุด' : 'ปักหมุด'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onToggleMute(conv.id, !muted)}>
            <BellOff className="h-4 w-4" aria-hidden="true" />
            {muted ? 'เปิดการแจ้งเตือน' : 'ปิดการแจ้งเตือน'}
          </DropdownMenuItem>
          {conv.unreadAdmin > 0 && (
            <DropdownMenuItem onSelect={() => onMarkRead(conv.id)}>
              ทำเป็นอ่านแล้ว
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
