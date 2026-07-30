'use client';

import { cn } from '@/lib/cn';
import { formatTime } from '../_lib/format';
import type { MessageSearchResult } from '../_lib/types';

export function SearchResults({
  results,
  searching,
  onOpen,
}: {
  results: MessageSearchResult[];
  searching: boolean;
  onOpen: (conversationId: string) => void;
}) {
  if (searching && results.length === 0) {
    return <p className="p-4 text-center text-sm text-muted">กำลังค้นหา...</p>;
  }
  if (results.length === 0) {
    return <p className="p-4 text-center text-sm text-muted">ไม่พบข้อความที่ค้นหา</p>;
  }
  return (
    <div>
      <p className="border-b border-border bg-surface-sunken/60 px-3 py-1.5 text-[11px] font-semibold text-muted">
        ผลค้นหาข้อความ ({results.length})
      </p>
      {results.map((r) => (
        <button
          key={r.messageId}
          type="button"
          onClick={() => onOpen(r.conversationId)}
          className={cn(
            'flex w-full flex-col gap-1 border-b border-border px-3 py-2.5 text-left',
            'transition-colors duration-normal ease-out-expo hover:bg-accent-sunken/50',
          )}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-semibold text-ink">
              {r.displayName ?? r.lineUserId.slice(0, 8)}
            </span>
            <span className="flex-none text-[10px] text-muted">{formatTime(r.createdAt)}</span>
          </span>
          <span className="line-clamp-2 text-xs text-muted">{r.snippet}</span>
        </button>
      ))}
    </div>
  );
}
