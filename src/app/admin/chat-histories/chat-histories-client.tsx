'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, History, RefreshCw, Search, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AdminCard } from '@/components/admin/admin-card';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/admin/empty-state';
import { LineAvatar } from '@/app/admin/chat/_components/line-avatar';
import { MessageList } from '@/app/admin/chat/_components/message-list';
import { useMessageSearch } from '@/app/admin/chat/_hooks/use-message-search';
import { fetchConversationPage, fetchConversations } from '@/app/admin/chat/_lib/api';
import { formatRelativeTime, formatTime } from '@/app/admin/chat/_lib/format';
import { MODE_LABELS } from '@/app/admin/chat/_lib/labels';
import type { Conversation, Message, MessageSearchResult } from '@/app/admin/chat/_lib/types';

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

function chatModeBadge(mode: string): string {
  if (mode === 'bot_active') return 'BOT';
  if (mode === 'human') return 'HUMAN';
  if (mode === 'resolved') return 'ปิดเรื่อง';
  return modeLabel(mode);
}

function groupSearchResults(results: MessageSearchResult[]): {
  key: string;
  displayName: string | null;
  lineUserId: string | null;
  first: MessageSearchResult;
  count: number;
}[] {
  const map = new Map<string, MessageSearchResult[]>();
  for (const item of results) {
    map.set(item.conversationId, [...(map.get(item.conversationId) ?? []), item]);
  }
  return [...map.entries()].map(([key, items]) => ({
    key,
    displayName: items[0]?.displayName ?? null,
    lineUserId: items[0]?.lineUserId ?? null,
    first: items[0]!,
    count: items.length,
  }));
}

/** § skeleton เป็น div ไม่ใช่ tr — rule a11y (control-has-associated-label) ตีความ tr เป็น control */
function TableSkeleton() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="animate-pulse border-b border-border/30 px-3 py-4 last:border-0">
          <div className="mb-2 h-4 w-3/4 rounded bg-surface-sunken" />
          <div className="h-3 w-1/2 rounded bg-surface-sunken/50" />
        </div>
      ))}
    </div>
  );
}

export function ChatHistoriesClient() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>('closed');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const { results: searchResults, searching } = useMessageSearch(query);

  const load = useCallback(async () => {
    const rows = await fetchConversations();
    if (rows) {
      setConversations(rows);
      setLoadError(null);
    } else {
      setConversations([]);
      setLoadError('โหลดข้อมูลไม่สำเร็จ');
    }
  }, []);

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

  const ITEMS_PER_PAGE = 20;
  const paged = useMemo(() => {
    const start = page * ITEMS_PER_PAGE;
    return visible.slice(start, start + ITEMS_PER_PAGE);
  }, [visible, page]);
  const totalPages = Math.max(1, Math.ceil(visible.length / ITEMS_PER_PAGE));

  // § เปลี่ยน filter/query กลับหน้าแรก — เรียกใน handler ไม่ใช่ effect (กัน set-state-in-effect)
  function handleFilterChange(next: HistoryFilter) {
    setFilter(next);
    setPage(0);
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    setPage(0);
  }

  const searchGroups = useMemo(() => groupSearchResults(searchResults), [searchResults]);

  return (
    <div className="space-y-4">
      <PageHeader title="ประวัติแชท" subtitle="ประวัติการสนทนาทั้งหมด">
        <button
          type="button"
          onClick={() => void load()}
          aria-label="รีเฟรช"
          className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md border border-border bg-surface text-muted hover:bg-accent-sunken hover:text-ink"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </button>
      </PageHeader>

      <AdminCard>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="ค้นหาข้อความในสนทนา..."
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
                onClick={() => handleFilterChange(chip.key)}
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
      </AdminCard>

      <AdminCard>
        {conversations === null ? (
          <TableSkeleton />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-left">
            <thead>
              <tr className="border-b border-border/50 text-xs text-muted">
                <th scope="col" className="px-3 py-2 font-medium">ผู้ใช้</th>
                <th scope="col" className="px-3 py-2 font-medium">ข้อความล่าสุด</th>
                <th scope="col" className="px-3 py-2 font-medium">เวลา</th>
                <th scope="col" className="px-3 py-2 font-medium">โหมดแชท</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-12 text-center">
                    <EmptyState
                      icon={History}
                      title={filter === 'closed' ? 'ยังไม่มีประวัติการสนทนาที่ปิดแล้ว' : 'ยังไม่มีประวัติการสนทนา'}
                      description={
                        filter === 'closed'
                          ? 'บทสนทนาที่ปิดห้องแล้วจะแสดงที่นี่เพื่อค้นหาย้อนหลัง'
                          : 'ประวัติข้อความจะแสดงที่นี่เมื่อมีการสนทนา'
                      }
                    />
                  </td>
                </tr>
              ) : (
                paged.map((conv) => {
                  const name = displayNameOf(conv);
                  return (
                    <tr key={conv.id} className="border-b border-border/30 last:border-0 hover:bg-accent/5">
                      <td className="px-3 py-2.5">
                        <Link href={`/admin/chat-histories/${conv.id}`} className="flex items-center gap-2.5">
                          <LineAvatar
                            src={conv.pictureUrl}
                            className="h-9 w-9 flex-none rounded-pill object-cover"
                            fallback={
                              <span
                                className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-pill bg-accent-sunken text-sm font-bold text-accent-strong"
                                aria-hidden="true"
                              >
                                {name.slice(0, 1).toUpperCase()}
                              </span>
                            }
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-accent-strong">{name}</span>
                            {conv.lineUserId && (
                              <span
                                className="block font-mono text-[10px] tabular-nums text-muted"
                                title="LINE user id (ปิดบังบางส่วน)"
                              >
                                {conv.lineUserId}
                              </span>
                            )}
                          </span>
                        </Link>
                      </td>
                      <td className="max-w-60 px-3 py-2.5">
                        {conv.lastMessageText ? (
                          <span className="block truncate text-sm text-muted">{conv.lastMessageText}</span>
                        ) : (
                          <span className="block truncate text-sm italic text-muted">ยังไม่มีข้อความ</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-muted">
                        {conv.lastMessageAt ? formatRelativeTime(conv.lastMessageAt) : '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="inline-flex items-center rounded-pill bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium text-muted">
                          {chatModeBadge(conv.mode)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        )}

        {hasQuery && searchGroups.length > 0 && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
              ผลค้นหาข้อความ — พบ {searchResults.length} ผลลัพธ์ใน {searchGroups.length} สนทนา
            </p>
            {searchGroups.map((g) => {
              const name =
                g.displayName ?? (g.lineUserId ? `ผู้ใช้ LINE ${g.lineUserId}` : 'ผู้ใช้ LINE');
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => router.push(`/admin/chat-histories/${g.key}`)}
                  aria-label={`เปิดสนทนาของ ${name} (${g.count} ผลลัพธ์)`}
                  className="flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors duration-normal ease-out-expo hover:bg-accent-sunken"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{name}</span>
                    <span className="line-clamp-1 text-[11px] text-muted">{g.first.snippet}</span>
                  </span>
                  <span className="flex-none text-[10px] text-muted">
                    พบ {g.count} ผลลัพธ์
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {!hasQuery && visible.length > 0 && (
          <div className="flex items-center justify-between pt-3 text-sm text-muted">
            <span>
              {visible.length} สนทนา (หน้า {page + 1}/{totalPages})
            </span>
            <span className="flex gap-1">
              <button
                type="button"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                aria-label="หน้าก่อนหน้า"
                className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md border border-border px-2 text-xs disabled:opacity-50"
              >
                ←
              </button>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                aria-label="หน้าถัดไป"
                className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md border border-border px-2 text-xs disabled:opacity-50"
              >
                →
              </button>
            </span>
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

/** § ตัดอักขระที่ Windows ห้ามในชื่อไฟล์ออก */
function exportFileName(displayName: string | null, ext: 'txt' | 'csv'): string {
  const base = (displayName || 'chat').replace(/[^\w฀-๿-]/g, '_');
  return `chat-${base}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function senderLabelOf(sender: string): string {
  if (sender === 'user') return 'ผู้ใช้';
  if (sender === 'bot') return 'บอท';
  return 'เจ้าหน้าที่';
}

function exportTxt(messages: Message[], displayName: string | null) {
  if (messages.length === 0) return;
  const lines = messages.map((m) => {
    const time = formatTime(m.createdAt);
    const role = senderLabelOf(m.sender);
    const text = m.textContent || `[${m.messageType}]`;
    return `[${time}] ${role}: ${text}`;
  });
  downloadBlob(
    new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }),
    exportFileName(displayName, 'txt'),
  );
}

/** § BOM จำเป็นเพื่อให้ Excel เปิดอ่านภาษาไทยได้ถูกต้อง */
function exportCsv(messages: Message[], displayName: string | null) {
  if (messages.length === 0) return;
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [
    ['เวลา', 'ผู้ส่ง', 'ประเภท', 'เนื้อหา'].join(','),
    ...messages.map((m) =>
      [
        esc(formatTime(m.createdAt)),
        esc(senderLabelOf(m.sender)),
        esc(m.messageType),
        esc(m.textContent || ''),
      ].join(','),
    ),
  ];
  downloadBlob(
    new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' }),
    exportFileName(displayName, 'csv'),
  );
}

export function ChatHistoryDetail({ conversationId }: { conversationId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [header, setHeader] = useState<HistoryHeader | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const page = await fetchConversationPage(conversationId);
      if (cancelled) return;
      if (!page) {
        setLoadError('โหลดข้อมูลไม่สำเร็จ');
        setLoaded(true);
        return;
      }
      setMessages(page.messages);
      setHasMore(page.hasMore);
      setHeader({
        displayName: page.conversation.displayName ?? null,
        pictureUrl: page.conversation.pictureUrl,
        lineUserId: page.conversation.lineUserId ?? null,
        mode: page.conversation.mode,
        lastMessageAt: page.conversation.lastMessageAt ?? null,
      });
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const firstId = messages[0]?.id;
  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    try {
      if (!firstId) return;
      const page = await fetchConversationPage(conversationId, { before: firstId });
      if (page) {
        setMessages((prev) => [...page.messages, ...prev]);
        setHasMore(page.hasMore);
      }
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, firstId, hasMore, loadingOlder]);

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
      <PageHeader title={name} subtitle={header?.lineUserId ?? undefined}>
        <Link
          href="/admin/chat-histories"
          className="inline-flex min-h-touch items-center justify-center gap-1 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-ink hover:bg-accent-sunken"
        >
          ← กลับ
        </Link>
        <button
          type="button"
          onClick={() => exportCsv(messages, header?.displayName ?? null)}
          disabled={messages.length === 0}
          aria-label="ดาวน์โหลด CSV"
          className="inline-flex min-h-touch items-center justify-center gap-1 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-ink hover:bg-accent-sunken disabled:opacity-50"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          CSV
        </button>
        <button
          type="button"
          onClick={() => exportTxt(messages, header?.displayName ?? null)}
          disabled={messages.length === 0}
          aria-label="ดาวน์โหลด TXT"
          className="inline-flex min-h-touch items-center justify-center gap-1 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-ink hover:bg-accent-sunken disabled:opacity-50"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          TXT
        </button>
      </PageHeader>

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
          <>
            {hasMore && (
              <div className="mb-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadOlder()}
                  disabled={loadingOlder}
                  className="inline-flex min-h-touch items-center justify-center gap-1 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-ink hover:bg-accent-sunken disabled:opacity-50"
                >
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  โหลดข้อความเก่า
                </button>
              </div>
            )}
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
          </>
        )}
      </AdminCard>
    </div>
  );
}
