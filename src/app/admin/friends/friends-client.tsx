'use client';

import { useMemo, useState } from 'react';
import { LayoutGrid, Search, UsersRound } from 'lucide-react';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { useResource } from '@/app/admin/_lib/use-resource';
import type { ApiResult } from '@/app/admin/_lib/admin-api';

type FollowState = 'following' | 'unfollowed';
type StatusFilter = 'all' | FollowState;

interface FriendItem {
  id: string;
  maskedId: string | null;
  displayName: string | null;
  pictureUrl: string | null;
  followState: FollowState;
  followCount: number;
  refollowCount: number;
  lastActiveAt: string | null;
  lastFollowAt: string | null;
  richMenuId: string | null;
  richMenuName: string | null;
}

interface FriendsPage {
  items: FriendItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface RichMenuOption {
  id: string;
  name: string;
  lineRichMenuId: string | null;
  status: string;
}

const PAGE_SIZE = 20;

// § fetch ตรงจากหน้านี้ — ไม่เพิ่ม helper ลง admin-api.ts (shared lib นอก scope PAR-3)
async function fetchJson<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return { ok: false, error: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ลองใหม่อีกครั้ง', status: 0 };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const msg = (body as { error?: unknown } | null)?.error;
    return { ok: false, error: typeof msg === 'string' ? msg : `เกิดข้อผิดพลาด (${res.status})`, status: res.status };
  }
  return { ok: true, data: body as T };
}

function loadFriends(query: string): Promise<ApiResult<FriendsPage>> {
  return fetchJson<FriendsPage>(`/api/line/admin/friends?${query}`);
}

function formatThaiDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

function initialOf(name: string | null): string {
  return (name ?? '').trim().charAt(0) || '?';
}

export function FriendsClient() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (q.trim()) params.set('q', q.trim());
    if (status !== 'all') params.set('status', status);
    return params.toString();
  }, [q, status, page]);

  const { data, loading, feedback, notify, reload } = useResource({
    load: loadFriends,
    query,
    debounceMs: 300,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [assignTarget, setAssignTarget] = useState<FriendItem | null>(null);
  const [menus, setMenus] = useState<RichMenuOption[] | null>(null);
  const [menusLoading, setMenusLoading] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);

  async function openAssign(friend: FriendItem) {
    setAssignTarget(friend);
    setSelectedMenu(friend.richMenuId ?? '');
    setMenus(null);
    setMenusLoading(true);
    const res = await fetchJson<{ items: RichMenuOption[] }>('/api/line/admin/rich-menus');
    setMenusLoading(false);
    if (res.ok) setMenus(res.data.items);
    else notify('error', res.error);
  }

  function closeAssign() {
    setAssignTarget(null);
    setMenus(null);
    setSelectedMenu('');
  }

  async function handleAssign() {
    if (!assignTarget) return;
    if (!selectedMenu) {
      notify('error', 'กรุณาเลือก Rich Menu');
      return;
    }
    setAssignSaving(true);
    const res = await fetchJson<{ ok: boolean }>(
      `/api/line/admin/friends/${assignTarget.id}/rich-menu`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ richMenuId: selectedMenu }),
      },
    );
    setAssignSaving(false);
    if (!res.ok) {
      notify('error', res.error);
      return;
    }
    notify('success', 'ผูกริชเมนูให้เพื่อนคนนี้แล้ว');
    closeAssign();
    await reload();
  }

  async function handleUnassign() {
    if (!assignTarget) return;
    if (!confirm(`ปลดริชเมนูเฉพาะบุคคลของ "${assignTarget.displayName ?? 'เพื่อนคนนี้'}"?`)) return;
    setAssignSaving(true);
    const res = await fetchJson<{ ok: boolean }>(
      `/api/line/admin/friends/${assignTarget.id}/rich-menu`,
      { method: 'DELETE' },
    );
    setAssignSaving(false);
    if (!res.ok) {
      notify('error', res.error);
      return;
    }
    notify('success', 'ปลดริชเมนูเฉพาะบุคคลแล้ว — จะใช้เมนู default แทน');
    closeAssign();
    await reload();
  }

  const isFiltered = q.trim() !== '' || status !== 'all';

  return (
    <>
      {feedback && (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 text-sm font-medium ${feedback.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}
        >
          {feedback.msg}
        </div>
      )}

      <AdminCard>
        <AdminCardTitle icon={<UsersRound className="h-4 w-4" />}>
          เพื่อน LINE ({total} คน)
        </AdminCardTitle>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              aria-label="ค้นหาเพื่อน"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="ค้นหาชื่อที่แสดง..."
              className="pl-9"
            />
          </div>
          <select
            aria-label="กรองสถานะ"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              setPage(1);
            }}
            className="min-h-touch rounded-lg border border-border/50 bg-surface px-3 text-sm"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="following">ติดตามอยู่</option>
            <option value="unfollowed">เลิกติดตาม</option>
          </select>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted">กำลังโหลด...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-muted">
            {isFiltered ? 'ไม่พบเพื่อนที่ตรงกับเงื่อนไข' : 'ยังไม่มีรายชื่อเพื่อน'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-160 text-left text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted">
                    <th scope="col" className="px-3 py-2 font-medium">เพื่อน</th>
                    <th scope="col" className="px-3 py-2 font-medium">สถานะ</th>
                    <th scope="col" className="px-3 py-2 font-medium">ติดตาม / กลับมา</th>
                    <th scope="col" className="px-3 py-2 font-medium">เคลื่อนไหวล่าสุด</th>
                    <th scope="col" className="px-3 py-2 font-medium">ริชเมนู</th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      <span className="sr-only">จัดการ</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((friend) => (
                    <tr key={friend.id} className="border-b border-border/30 last:border-0">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {friend.pictureUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={friend.pictureUrl}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <span
                              aria-hidden
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/15 font-medium text-muted"
                            >
                              {initialOf(friend.displayName)}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">
                              {friend.displayName ?? 'ไม่ระบุชื่อ'}
                            </p>
                            <p className="font-mono text-xs text-muted" title="ID แบบปกปิด — ไม่ใช่ LINE id จริง">
                              {friend.maskedId ?? '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${friend.followState === 'following' ? 'bg-success/10 text-success' : 'bg-muted/10 text-muted'}`}
                        >
                          {friend.followState === 'following' ? 'ติดตามอยู่' : 'เลิกติดตาม'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-muted">
                        {friend.followCount} / {friend.refollowCount}
                      </td>
                      <td className="px-3 py-2.5 text-muted">{formatThaiDateTime(friend.lastActiveAt)}</td>
                      <td className="px-3 py-2.5 text-muted">
                        {friend.richMenuName ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          variant="outline"
                          onClick={() => openAssign(friend)}
                          className="min-h-touch gap-1 text-xs"
                        >
                          <LayoutGrid className="h-3.5 w-3.5" /> กำหนดริชเมนู
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between pt-3 text-sm text-muted">
              <span>
                หน้า {page} จาก {totalPages} (ทั้งหมด {total} คน)
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="min-h-touch text-xs"
                >
                  หน้าก่อนหน้า
                </Button>
                <Button
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="min-h-touch text-xs"
                >
                  หน้าถัดไป
                </Button>
              </div>
            </div>
          </>
        )}
      </AdminCard>

      <Dialog open={assignTarget !== null} onOpenChange={(open) => { if (!open) closeAssign(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              กำหนดริชเมนู — {assignTarget?.displayName ?? 'เพื่อน'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted">
              ปัจจุบัน: {assignTarget?.richMenuName ?? 'ใช้เมนู default'}
            </p>
            <div>
              <Label htmlFor="friend-rich-menu">เลือก Rich Menu</Label>
              {menusLoading ? (
                <p className="py-2 text-sm text-muted">กำลังโหลดรายการเมนู...</p>
              ) : (
                <select
                  id="friend-rich-menu"
                  value={selectedMenu}
                  onChange={(e) => setSelectedMenu(e.target.value)}
                  className="min-h-touch w-full rounded-lg border border-border/50 bg-surface px-3 text-sm"
                >
                  <option value="">เลือกเมนู...</option>
                  {(menus ?? []).map((m) => (
                    <option key={m.id} value={m.id} disabled={!m.lineRichMenuId}>
                      {m.name}{m.lineRichMenuId ? '' : ' (ยังไม่ sync)'}
                    </option>
                  ))}
                </select>
              )}
              <p className="mt-1 text-xs text-muted">
                เมนูที่ยังไม่ sync ขึ้น LINE เลือกไม่ได้ — กด Sync ที่หน้าริชเมนูก่อน
              </p>
            </div>
          </div>
          <DialogFooter>
            {assignTarget?.richMenuId && (
              <Button variant="outline" onClick={handleUnassign} disabled={assignSaving} className="mr-auto">
                ปลดเมนู
              </Button>
            )}
            <Button variant="ghost" onClick={closeAssign}>ยกเลิก</Button>
            <Button onClick={handleAssign} disabled={assignSaving || menusLoading}>
              {assignSaving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
