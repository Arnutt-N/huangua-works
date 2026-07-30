'use client';

import { ArrowDownWideNarrow, Clock, MessagesSquare, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ConversationFilter, ConversationSort } from '../_hooks/use-conversations';
import type { Conversation, MessageSearchResult } from '../_lib/types';
import { ConversationItem } from './conversation-item';
import { SearchResults } from './search-results';

const FILTER_CHIPS: { key: ConversationFilter; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'waiting', label: 'รอรับเรื่อง' },
  { key: 'active', label: 'กำลังคุย' },
];

function SkeletonRows() {
  return (
    <div aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse space-y-2 border-b border-border px-3 py-3">
          <div className="h-3.5 w-2/3 rounded-md bg-surface-sunken" />
          <div className="h-3 w-full rounded-md bg-surface-sunken" />
          <div className="h-4 w-20 rounded-pill bg-surface-sunken" />
        </div>
      ))}
    </div>
  );
}

export function ConversationList({
  visible,
  counts,
  loading,
  filter,
  setFilter,
  sort,
  setSort,
  query,
  setQuery,
  searchResults,
  searching,
  selectedId,
  onSelect,
  onTogglePin,
  onToggleMute,
  onMarkRead,
}: {
  visible: Conversation[];
  counts: { all: number; waiting: number; active: number };
  loading: boolean;
  filter: ConversationFilter;
  setFilter: (f: ConversationFilter) => void;
  sort: ConversationSort;
  setSort: (s: ConversationSort) => void;
  query: string;
  setQuery: (q: string) => void;
  searchResults: MessageSearchResult[];
  searching: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onToggleMute: (id: string, muted: boolean) => void;
  onMarkRead: (id: string) => void;
}) {
  const hasQuery = query.trim().length > 0;

  return (
    <div
      className={cn(
        'flex-col border-r border-border sm:flex sm:w-80 sm:flex-none',
        selectedId ? 'hidden' : 'flex w-full',
      )}
    >
      <div className="space-y-2 border-b border-border bg-surface-sunken/60 px-3 py-3">
        <div className="flex items-center gap-2 px-1">
          <MessagesSquare className="h-4 w-4 flex-none text-accent-strong" aria-hidden="true" />
          <h2 className="truncate text-sm font-bold text-ink">การสนทนา LINE</h2>
          <button
            type="button"
            onClick={() => setSort(sort === 'newest' ? 'oldest' : 'newest')}
            aria-label={sort === 'newest' ? 'เรียงตามรอนานสุด' : 'เรียงตามล่าสุด'}
            title={sort === 'newest' ? 'ล่าสุดก่อน — กดเพื่อสลับเป็นรอนานสุด' : 'รอนานสุดก่อน — กดเพื่อสลับเป็นล่าสุด'}
            className="ml-auto inline-flex h-7 w-7 flex-none items-center justify-center rounded-md text-muted hover:bg-accent-sunken hover:text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong"
          >
            {sort === 'newest' ? (
              <ArrowDownWideNarrow className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Clock className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อหรือข้อความ..."
            aria-label="ค้นหาการสนทนา"
            className={cn(
              'h-9 w-full rounded-md border border-border bg-surface-raised pl-8 pr-3 text-sm text-ink placeholder:text-muted',
              'transition-colors duration-normal ease-out-expo',
              'focus:border-accent-strong focus:outline-none focus-visible:ring focus-visible:ring-accent-strong/35',
            )}
          />
        </div>

        <div className="flex gap-1.5" role="group" aria-label="กรองการสนทนา">
          {FILTER_CHIPS.map((chip) => {
            const count =
              chip.key === 'all' ? counts.all : chip.key === 'waiting' ? counts.waiting : counts.active;
            const active = filter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilter(chip.key)}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset',
                  'transition-colors duration-normal ease-out-expo',
                  active
                    ? 'bg-accent-strong text-on-accent ring-accent-strong'
                    : 'bg-surface-raised text-muted ring-border hover:text-accent-strong',
                )}
              >
                {chip.label}
                <span className={cn('text-[10px]', active ? 'text-on-accent/80' : 'text-muted')}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <SkeletonRows />
        ) : hasQuery ? (
          <>
            {visible.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isSelected={selectedId === conv.id}
                onSelect={onSelect}
                onTogglePin={onTogglePin}
                onToggleMute={onToggleMute}
                onMarkRead={onMarkRead}
              />
            ))}
            <SearchResults results={searchResults} searching={searching} onOpen={onSelect} />
          </>
        ) : visible.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted">ยังไม่มีการสนทนา</p>
        ) : (
          visible.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isSelected={selectedId === conv.id}
              onSelect={onSelect}
              onTogglePin={onTogglePin}
              onToggleMute={onToggleMute}
              onMarkRead={onMarkRead}
            />
          ))
        )}
      </div>

      <div className="border-t border-border bg-surface-sunken/60 px-3 py-2 text-[11px] text-muted">
        {counts.all} การสนทนา · รอรับเรื่อง {counts.waiting} · กำลังคุย {counts.active}
      </div>
    </div>
  );
}
