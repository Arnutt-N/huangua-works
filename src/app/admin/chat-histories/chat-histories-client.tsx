'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { EmptyState } from '@/components/admin/empty-state';
import { LineAvatar } from '@/app/admin/chat/_components/line-avatar';
import { MessageList } from '@/app/admin/chat/_components/message-list';
import { SearchResults } from '@/app/admin/chat/_components/search-results';
import { useMessageSearch } from '@/app/admin/chat/_hooks/use-message-search';
import { fetchConversationPage, fetchConversations } from '@/app/admin/chat/_lib/api';
import { formatRelativeTime } from '@/app/admin/chat/_lib/format';
import { MODE_LABELS } from '@/app/admin/chat/_lib/labels';
import type { Conversation, Message } from '@/app/admin/chat/_lib/types';

export type HistoryFilter = 'closed' | 'all';

const FILTERS: { key: HistoryFilter; label: string }[] = [
  { key: 'closed', label: 'ปิดแล้ว' },
  { key: 'all', label: 'ทั้งหมด' },
];

function modeLabel(mode: string): string {
  return MODE_LABELS[mode] ?? 'ไม่ระบุสถานะ';
}

function displayNameOf(conv: Conversation): string {
  if (conv.displayName) return conv.displayName;
  return conv.lineUserId ? `ผู้ใช้ LINE ${conv.lineUserId}` : 'ผู้ใช้ LINE';
}

export function ChatHistoriesClient() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>('closed');
  const [query, setQuery] = useState('');
  const { results: searchResults, searching } = useMessageSearch(query);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await fetchConversations();
      if (cancelled) return;
      if (rows) {
        setConversations(rows);
        setLoadError(null);
      } else {
        setConversations([]);
        setLoadError('โหลดข้อมูลไม่สำเร็จ');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const list = conversations ?? [];
    return {
      all: list.length,
      closed: list.filter((c) => c.mode === 'resolved').length,
    };
  }, [conversations]);

  const visible = useMemo(() => {
    let list = conversations ?? [];
    if (filter === 'closed') list = list.filter((c) => c.mode === 'resolved');
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          (c.displayName ?? '').toLowerCase().includes(q) ||
          (c.lineUserId ?? '').toLowerCase().includes(q) ||
          (c.lastMessageText ?? '').toLowerCase().includes(q),
      );
    }
    const time = (c: Conversation) => (c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : 0);
    return [...list].sort((a, b) => time(b) - time(a));
  }, [conversations, filter, query]);

  const hasQuery = query.trim().length > 0;

  return (
    <div className="space-y-4">
      <AdminCard>
        <AdminCardTitle icon={<History className="h-4 w-4" />}>
          ประวัติการสนทนา {conversations !== null && `(${visible.length.toLocaleString('th-TH')})`}
        </AdminCardTitle>

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
            aria-label="ค้นหาประวัติการสนทนา"
            className={cn(
              'w-full rounded-md border border-border bg-surface py-2 pl-10 pr-3 text-sm text-ink placeholder:text-muted',
              'focus:border-accent/40 focus:outline-none focus-visible:ring focus-visible:ring-accent/40',
            )}
          />
        </div>

        <div className="mt-3 flex items-center gap-1.5" role="group" aria-label="กรองประวัติการสนทนา">
          {FILTERS.map((chip) => {
            const count = chip.key === 'all' ? counts.all : counts.closed;
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
        </div>

        {loadError && (
          <p role="status" className="mt-3 text-sm text-danger">
            {loadError}
          </p>
        )}

        <div className="mt-3">
          {conversations === null ? (
            <p className="py-10 text-center text-sm text-muted">กำลังโหลด...</p>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={History}
              title={hasQuery ? 'ไม่พบประวัติที่ค้นหา' : 'ยังไม่มีประวัติการสนทนาที่ปิดแล้ว'}
              description={
                hasQuery
                  ? 'ลองค้นด้วยชื่อหรือคำอื่น'
                  : 'บทสนทนาที่ปิดห้องแล้วจะแสดงที่นี่เพื่อค้นหาย้อนหลัง'
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((conv) => {
                const name = displayNameOf(conv);
                return (
                  <li key={conv.id}>
                    <Link
                      href={`/admin/chat-histories/${conv.id}`}
                      className="flex items-center gap-3 p-3 text-left transition-colors duration-normal ease-out-expo hover:bg-accent-sunken"
                    >
                      <LineAvatar
                        src={conv.pictureUrl}
                        className="h-10 w-10 flex-none rounded-pill object-cover"
                        fallback={
                          <span
                            className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-pill bg-accent-sunken text-sm font-bold text-accent-strong"
                            aria-hidden="true"
                          >
                            {name.slice(0, 1).toUpperCase()}
                          </span>
                        }
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-ink">{name}</span>
                          <span className="ml-auto flex-none text-[10px] tabular-nums text-muted">
                            {formatRelativeTime(conv.lastMessageAt)}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-xs text-muted">
                            {conv.lastMessageText ?? '—'}
                          </span>
                          <span className="ml-auto inline-flex flex-none items-center rounded-pill bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium text-muted">
                            {modeLabel(conv.mode)}
                          </span>
                        </span>
                        {conv.lineUserId && (
                          <span
                            className="text-[10px] tabular-nums text-muted"
                            title="LINE user id (ปิดบังบางส่วน)"
                          >
                            {conv.lineUserId}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {hasQuery && (
          <div className="mt-3 border-t border-border pt-3">
            <SearchResults
              results={searchResults}
              searching={searching}
              onOpen={(id) => router.push(`/admin/chat-histories/${id}`)}
            />
          </div>
        )}
      </AdminCard>
    </div>
  );
}

interface HistoryHeader {
  displayName: string | null;
  pictureUrl: string | null | undefined;
  lineUserId: string | null;
  mode: string;
  lastMessageAt: string | null;
}

export function ChatHistoryDetail({ conversationId }: { conversationId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [header, setHeader] = useState<HistoryHeader | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [page, rows] = await Promise.all([
        fetchConversationPage(conversationId),
        fetchConversations(),
      ]);
      if (cancelled) return;
      if (!page) {
        setLoadError('โหลดข้อมูลไม่สำเร็จ');
        setLoaded(true);
        return;
      }
      setMessages(page.messages);
      setHasMore(page.hasMore);
      const match = rows?.find((c) => c.id === conversationId) ?? null;
      setHeader({
        displayName: match?.displayName ?? null,
        pictureUrl: match?.pictureUrl,
        lineUserId: match?.lineUserId ?? null,
        mode: page.conversation.mode,
        lastMessageAt: match?.lastMessageAt ?? null,
      });
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const firstId = messages[0]?.id;
  const loadOlder = useCallback(async () => {
    if (!firstId) return;
    const page = await fetchConversationPage(conversationId, { before: firstId });
    if (page) {
      setMessages((prev) => [...page.messages, ...prev]);
      setHasMore(page.hasMore);
    }
  }, [conversationId, firstId]);

  if (!loaded) {
    return <p className="py-12 text-center text-sm text-muted">กำลังโหลด...</p>;
  }

  if (loadError) {
    return (
      <p role="status" className="py-12 text-center text-sm text-danger">
        {loadError}
      </p>
    );
  }

  const name =
    header?.displayName ?? (header?.lineUserId ? `ผู้ใช้ LINE ${header.lineUserId}` : 'ผู้ใช้ LINE');

  return (
    <div className="space-y-4">
      <Link
        href="/admin/chat-histories"
        className="inline-flex items-center gap-1 text-sm font-semibold text-accent-strong hover:underline"
      >
        ← กลับประวัติการสนทนา
      </Link>

      <AdminCard>
        <div className="mb-4 flex items-center gap-3">
          <LineAvatar
            src={header?.pictureUrl}
            className="h-12 w-12 flex-none rounded-pill object-cover ring-2 ring-accent/20"
            fallback={
              <span
                className="inline-flex h-12 w-12 flex-none items-center justify-center rounded-pill bg-accent-sunken text-lg font-bold text-accent-strong ring-2 ring-accent/20"
                aria-hidden="true"
              >
                {name.slice(0, 1).toUpperCase()}
              </span>
            }
          />
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-ink">{name}</p>
            <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
              {header?.lineUserId && (
                <span className="tabular-nums" title="LINE user id (ปิดบังบางส่วน)">
                  {header.lineUserId}
                </span>
              )}
              <span className="inline-flex items-center rounded-pill bg-surface-sunken px-1.5 py-0.5 font-medium">
                {modeLabel(header?.mode ?? '')}
              </span>
              {header?.lastMessageAt && <span>{formatRelativeTime(header.lastMessageAt)}</span>}
            </p>
          </div>
        </div>

        {messages.length === 0 ? (
          <EmptyState
            icon={History}
            title="ห้องนี้ยังไม่มีข้อความ"
            description="ประวัติข้อความจะแสดงที่นี่เมื่อมีการสนทนา"
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <MessageList
              messages={messages}
              customerName={header?.displayName ?? null}
              customerPicture={header?.pictureUrl ?? null}
              hasMore={hasMore}
              onLoadOlder={() => void loadOlder()}
              onRetry={() => undefined}
            />
          </div>
        )}
      </AdminCard>
    </div>
  );
}
