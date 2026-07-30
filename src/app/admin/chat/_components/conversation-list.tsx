'use client';

import Link from 'next/link';
import { ArrowDownWideNarrow, Home, Inbox, Search } from 'lucide-react';
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
    <div className="space-y-1 py-2" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-3 rounded-xl bg-surface-sunken p-3"
        >
          <div className="h-10 w-10 flex-none rounded-pill bg-border" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-2/3 rounded-sm bg-border" />
            <div className="h-3 w-full rounded-sm bg-border" />
          </div>
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

  const rows = visible.map((conv) => (
    <ConversationItem
      key={conv.id}
      conversation={conv}
      isSelected={selectedId === conv.id}
      onSelect={onSelect}
      onTogglePin={onTogglePin}
      onToggleMute={onToggleMute}
      onMarkRead={onMarkRead}
    />
  ));

  return (
    <aside
      className={cn(
        'w-full flex-none flex-col overflow-hidden border-r border-border',
        'bg-surface-raised text-ink md:flex md:w-80',
        selectedId ? 'hidden md:flex' : 'flex',
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-20 flex-none items-center gap-3 border-b border-border px-4">
          <Link
            href="/admin"
            aria-label="กลับหน้าแดชบอร์ดผู้ดูแล"
            title="กลับหน้าแดชบอร์ดผู้ดูแล"
            className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-accent-gradient text-on-accent shadow-lg ring-4 ring-accent/10 transition-shadow duration-normal ease-out-expo hover:shadow-accent-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong"
          >
            <Home className="h-5 w-5" aria-hidden="true" />
          </Link>
          <h2 className="flex-1 truncate text-center text-base font-bold tracking-wide text-ink">
            การสนทนา LINE
          </h2>
          <span className="h-10 w-10 flex-none" aria-hidden="true" />
        </div>

        <div className="flex-none space-y-2.5 px-3 py-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อหรือข้อความ..."
              aria-label="ค้นหาการสนทนา"
              className={cn(
                'w-full rounded-md border border-border bg-surface py-2 pl-10 pr-3 text-sm text-ink placeholder:text-muted',
                'transition-colors duration-normal ease-out-expo',
                'focus:border-accent/40 focus:outline-none focus-visible:ring focus-visible:ring-accent/40',
              )}
            />
          </div>

          <div className="flex items-center gap-1.5" role="group" aria-label="กรองการสนทนา">
            {FILTER_CHIPS.map((chip) => {
              const count =
                chip.key === 'all'
                  ? counts.all
                  : chip.key === 'waiting'
                    ? counts.waiting
                    : counts.active;
              const active = filter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setFilter(chip.key)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold',
                    'transition-colors duration-normal ease-out-expo',
                    active
                      ? 'bg-accent-gradient text-on-accent shadow-lg'
                      : 'bg-surface-sunken text-muted hover:text-ink',
                  )}
                >
                  {chip.label}
                  <span
                    className={cn(
                      'inline-flex h-4 min-w-4 items-center justify-center rounded-pill px-1 text-[10px] tabular-nums',
                      active ? 'bg-white/20 text-on-accent' : 'bg-surface-raised text-muted',
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setSort(sort === 'newest' ? 'oldest' : 'newest')}
              aria-label={sort === 'newest' ? 'เรียงตามรอนานสุด' : 'เรียงตามล่าสุด'}
              aria-pressed={sort === 'oldest'}
              title={
                sort === 'newest'
                  ? 'ล่าสุดก่อน — กดเพื่อสลับเป็นรอนานสุด'
                  : 'รอนานสุดก่อน — กดเพื่อสลับเป็นล่าสุด'
              }
              className={cn(
                'inline-flex flex-none items-center justify-center rounded-md px-2 py-1.5',
                'transition-colors duration-normal ease-out-expo',
                sort === 'oldest'
                  ? 'bg-accent-gradient text-on-accent shadow-lg'
                  : 'bg-surface-sunken text-muted hover:text-ink',
              )}
            >
              <ArrowDownWideNarrow className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {loading ? (
            <SkeletonRows />
          ) : hasQuery ? (
            <>
              <div className="space-y-1 py-2">{rows}</div>
              <SearchResults results={searchResults} searching={searching} onOpen={onSelect} />
            </>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Inbox className="h-10 w-10 text-muted" aria-hidden="true" />
              <p className="text-sm text-muted">ยังไม่มีการสนทนา</p>
            </div>
          ) : (
            <div className="space-y-1 py-2">{rows}</div>
          )}
        </div>

        <div className="flex-none border-t border-border bg-surface-sunken px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-success">
              <span className="h-1.5 w-1.5 rounded-pill bg-success" aria-hidden="true" />
              กำลังคุย {counts.active}
            </span>
            <span className="inline-flex items-center gap-1.5 text-warning">
              <span className="h-1.5 w-1.5 rounded-pill bg-warning" aria-hidden="true" />
              รอรับเรื่อง {counts.waiting}
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted">
              <span className="h-1.5 w-1.5 rounded-pill bg-muted" aria-hidden="true" />
              ทั้งหมด {counts.all}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
