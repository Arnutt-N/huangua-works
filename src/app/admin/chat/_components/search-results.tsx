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
    return <p className="px-2 py-2 text-center text-xs text-sidebar-text-muted">กำลังค้นหา...</p>;
  }
  if (results.length === 0) {
    return (
      <p className="px-2 py-2 text-center text-xs text-sidebar-text-muted">ไม่พบข้อความที่ค้นหา</p>
    );
  }
  return (
    <div className="space-y-1 pb-2">
      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-sidebar-text-muted">
        ผลค้นหาข้อความ ({results.length})
      </p>
      {results.map((r) => (
        <button
          key={r.messageId}
          type="button"
          onClick={() => onOpen(r.conversationId)}
          className={cn(
            'flex w-full flex-col gap-1 rounded-md border border-white/10 bg-white/5 p-2 text-left',
            'transition-colors duration-normal ease-out-expo hover:bg-white/10',
          )}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] font-medium text-sidebar-fg">
              {r.displayName ?? r.lineUserId.slice(0, 8)}
            </span>
            <span className="flex-none text-[11px] text-sidebar-text-muted tabular-nums">
              {formatTime(r.createdAt)}
            </span>
          </span>
          <span className="line-clamp-2 text-[11px] text-sidebar-text-muted">{r.snippet}</span>
        </button>
      ))}
    </div>
  );
}
