'use client';

import { memo } from 'react';
import { Bot, CheckCheck, MoreVertical, Pin, PinOff, User, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatRelativeTime, maskLineUserId } from '../_lib/format';
import { MODE_SHORT } from '../_lib/labels';
import type { Conversation } from '../_lib/types';
import { LineAvatar } from './line-avatar';

const MAX_TAGS = 2;

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
  const name = conv.displayName ?? `ผู้ใช้ LINE ${maskLineUserId(conv.lineUserId)}`;
  const isBot = conv.mode === 'bot_active';
  const tags = conv.tags ?? [];
  const extraTags = tags.length - MAX_TAGS;

  return (
    <div
      className={cn(
        'group relative rounded-lg',
        'transition-colors duration-normal ease-out-expo',
        isSelected
          ? 'bg-accent-sunken text-ink ring-1 ring-accent/30'
          : 'text-ink hover:bg-accent-sunken',
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(conv.id)}
        aria-current={isSelected ? 'true' : undefined}
        className="flex w-full items-center gap-3 p-3 pr-9 text-left"
      >
        <LineAvatar
          src={conv.pictureUrl}
          className="h-10 w-10 flex-none rounded-pill object-cover"
          fallback={
            <span
              className={cn(
                'inline-flex h-10 w-10 flex-none items-center justify-center rounded-pill text-sm font-bold',
                isSelected ? 'bg-accent text-on-accent' : 'bg-accent-sunken text-accent-strong',
              )}
              aria-hidden="true"
            >
              {name.slice(0, 1).toUpperCase()}
            </span>
          }
        />

        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-1.5">
            {pinned && (
              <Pin
                className={cn('h-3 w-3 flex-none', 'text-accent-gold')}
                aria-label="ปักหมุด"
              />
            )}
            {muted && (
              <VolumeX
                className={cn(
                  'h-3 w-3 flex-none',
                  'text-muted',
                )}
                aria-label="ปิดการแจ้งเตือน"
              />
            )}
            <span
              className={cn(
                'truncate text-sm font-semibold',
                'text-ink',
              )}
            >
              {name}
            </span>
            <span
              className={cn(
                'ml-auto flex-none text-[10px] tabular-nums',
                'text-muted',
              )}
            >
              {formatRelativeTime(conv.lastMessageAt)}
            </span>
          </span>

          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                'truncate text-xs',
                'text-muted',
              )}
            >
              {conv.lastMessageText ?? '—'}
            </span>
            <span className="ml-auto flex flex-none items-center gap-1">
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 text-[10px] font-medium',
                  isBot
                    ? 'bg-accent-sunken text-accent-strong'
                    : 'bg-success-soft text-success-ink',
                )}
              >
                {isBot ? (
                  <Bot className="h-2.5 w-2.5" aria-hidden="true" />
                ) : (
                  <User className="h-2.5 w-2.5" aria-hidden="true" />
                )}
                {MODE_SHORT[conv.mode] ?? conv.mode}
              </span>
              {conv.unreadAdmin > 0 && (
                <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-danger px-1 text-[10px] font-bold tabular-nums text-white">
                  {conv.unreadAdmin > 9 ? '9+' : conv.unreadAdmin}
                </span>
              )}
            </span>
          </span>

          {tags.length > 0 && (
            <span className="flex flex-wrap items-center gap-1">
              {tags.slice(0, MAX_TAGS).map((tag) => (
                <span
                  key={tag.id}
                  className={cn(
                    'inline-block rounded-pill px-1.5 py-0.5 text-[10px] font-medium',
                    'bg-surface-sunken text-muted',
                  )}
                >
                  {tag.name}
                </span>
              ))}
              {extraTags > 0 && (
                <span
                  className={cn(
                    'text-[10px] font-medium',
                    'text-muted',
                  )}
                >
                  +{extraTags}
                </span>
              )}
            </span>
          )}
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`ตัวเลือกของ ${name}`}
          className={cn(
            'absolute right-1.5 top-3 inline-flex h-7 w-7 items-center justify-center rounded-sm',
            'opacity-0 transition-opacity duration-fast focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100',
            'focus-visible:outline focus-visible:outline-2',
            'text-muted hover:bg-accent-sunken hover:text-ink focus-visible:outline-accent',
          )}
        >
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onTogglePin(conv.id, !pinned)}>
            {pinned ? (
              <PinOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Pin className="h-4 w-4" aria-hidden="true" />
            )}
            {pinned ? 'เลิกปักหมุด' : 'ปักหมุด'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onToggleMute(conv.id, !muted)}>
            {muted ? (
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <VolumeX className="h-4 w-4" aria-hidden="true" />
            )}
            {muted ? 'เปิดการแจ้งเตือน' : 'ปิดการแจ้งเตือน'}
          </DropdownMenuItem>
          {conv.unreadAdmin > 0 && (
            <DropdownMenuItem onSelect={() => onMarkRead(conv.id)}>
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              ทำเป็นอ่านแล้ว
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
