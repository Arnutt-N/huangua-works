'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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
import { adminApi, type FriendItem, type RichMenuItem } from '@/app/admin/_lib/admin-api';
import { isUsableMenu } from '@/app/admin/chatbot/rich-menus/menu-predicates';

type StatusFilter = 'all' | FriendItem['followState'];

const PAGE_SIZE = 20;

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMenu, setBulkMenu] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (q.trim()) params.set('q', q.trim());
    if (status !== 'all') params.set('status', status);
    return params.toString();
  }, [q, status, page]);

  const { data, loading, feedback, notify, reload } = useResource({
    load: adminApi.listFriends,
    query,
    debounceMs: 300,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [assignTarget, setAssignTarget] = useState<FriendItem | null>(null);
  const [menus, setMenus] = useState<RichMenuItem[] | null>(null);
  const [menusLoading, setMenusLoading] = useState(false);
  const [menusError, setMenusError] = useState<string | null>(null);
  const [selectedMenu, setSelectedMenu] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);

  async function openAssign(friend: FriendItem) {
    setAssignTarget(friend);
    setSelectedMenu(friend.richMenuId ?? '');
    setMenus(null);
    setMenusError(null);
    setMenusLoading(true);
    const res = await adminApi.listRichMenus();
    setMenusLoading(false);
    if (res.ok) setMenus(res.data.items);
    else setMenusError(res.error);
  }

  function closeAssign() {
    setAssignTarget(null);
    setMenus(null);
    setMenusError(null);
    setSelectedMenu('');
  }

  async function handleAssign() {
    if (!assignTarget) return;
    if (!selectedMenu) {
      notify('error', 'กรุณาเลือก Rich Menu');
      return;
    }
    setAssignSaving(true);
    const res = await adminApi.assignUserRichMenu(assignTarget.id, selectedMenu);
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
    const res = await adminApi.unassignUserRichMenu(assignTarget.id);
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
  const bulkMenusRes = useResource({ load: adminApi.listRichMenus });
  const bulkMenus = bulkMenusRes.data?.items ?? [];
  const usableBulkMenus = bulkMenus.filter(isUsableMenu);

  function toggleSelect(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelected(checked ? new Set(items.map((f) => f.id)) : new Set());
  }

  async function handleBulkAssign() {
    if (selected.size === 0 || !bulkMenu) {
      notify('error', 'กรุณาเลือกเพื่อนและ Rich Menu');
      return;
    }
    if (!confirm(`กำหนดริชเมนูให้เพื่อน ${selected.size} คน?`)) return;
    setBulkSaving(true);
    const ids = [...selected];
    let failed = 0;
    for (const id of ids) {
      const res = await adminApi.assignUserRichMenu(id, bulkMenu);
      if (!res.ok) failed += 1;
    }
    setBulkSaving(false);
    setBulkOpen(false);
    setBulkMenu('');
    setSelected(new Set());
    if (failed > 0) notify('error', `กำหนดไม่สำเร็จ ${failed} คน`);
    else notify('success', `กำหนดริชเมนูให้เพื่อน ${ids.length} คนแล้ว`);
    await reload();
  }

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
            {selected.size > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm">
                <span className="font-medium text-ink">เลือก {selected.size} คน</span>
                <Button variant="outline" onClick={() => setBulkOpen(true)} className="min-h-touch gap-1 text-xs">
                  <LayoutGrid className="h-3.5 w-3.5" /> กำหนด Rich Menu
                </Button>
                <Button variant="ghost" onClick={() => setSelected(new Set())} className="min-h-touch text-xs">
                  ล้างการเลือก
                </Button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-160 text-left text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted">
                    <th scope="col" className="px-3 py-2 font-medium">
                      <input
                        type="checkbox"
                        aria-label="เลือกทั้งหมดในหน้านี้"
                        checked={items.length > 0 && items.every((f) => selected.has(f.id))}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                        className="h-4 w-4"
                      />
                    </th>
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
                        <input
                          type="checkbox"
                          aria-label={`เลือก ${friend.displayName ?? 'เพื่อน'}`}
                          checked={selected.has(friend.id)}
                          onChange={(e) => toggleSelect(friend.id, e.target.checked)}
                          className="h-4 w-4"
                        />
                      </td>
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
                            <Link
                              href={`/admin/friends/${friend.id}`}
                              className="truncate font-medium text-accent-strong hover:underline"
                            >
                              {friend.displayName ?? 'ไม่ระบุชื่อ'}
                            </Link>
                            {friend.refollowCount > 0 && (
                              <span className="ml-2 rounded-full bg-accent-sunken px-1.5 py-0.5 text-[10px] font-bold text-accent-strong">
                                กลับมา {friend.refollowCount} ครั้ง
                              </span>
                            )}
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
              ) : menusError ? (
                <div className="space-y-2 py-2">
                  <p className="text-sm text-danger">โหลดรายการเมนูไม่สำเร็จ: {menusError}</p>
                  <Button
                    variant="outline"
                    onClick={() => assignTarget && openAssign(assignTarget)}
                    className="min-h-touch text-xs"
                  >
                    ลองใหม่
                  </Button>
                </div>
              ) : (
                <select
                  id="friend-rich-menu"
                  value={selectedMenu}
                  onChange={(e) => setSelectedMenu(e.target.value)}
                  className="min-h-touch w-full rounded-lg border border-border/50 bg-surface px-3 text-sm"
                >
                  <option value="">เลือกเมนู...</option>
                  {(menus ?? []).map((m) => {
                    const usable = m.lineRichMenuId && m.status !== 'inactive';
                    return (
                      <option key={m.id} value={m.id} disabled={!usable}>
                        {m.name}{usable ? '' : ' (ใช้ไม่ได้ — ยังไม่ sync หรือปิดใช้งาน)'}
                      </option>
                    );
                  })}
                </select>
              )}
              <p className="mt-1 text-xs text-muted">
                เมนูที่ยังไม่ sync ขึ้น LINE หรือถูกปิดใช้งานเลือกไม่ได้ — จัดการที่หน้าริชเมนู
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
            <Button onClick={handleAssign} disabled={assignSaving || menusLoading || !!menusError}>
              {assignSaving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>กำหนดริชเมนู {selected.size} คน</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="friend-bulk-menu">เลือก Rich Menu (bulk)</Label>
              <select
                id="friend-bulk-menu"
                value={bulkMenu}
                onChange={(e) => setBulkMenu(e.target.value)}
                className="min-h-touch w-full rounded-lg border border-border/50 bg-surface px-3 text-sm"
              >
                <option value="">เลือกเมนู...</option>
                {usableBulkMenus.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
                {bulkMenus.filter((m) => !(m.lineRichMenuId && m.status !== 'inactive')).map((m) => (
                  <option key={m.id} value={m.id} disabled>
                    {m.name} (ใช้ไม่ได้ — ยังไม่ sync หรือปิดใช้งาน)
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted">
                ยิงรายคนทีละคำสั่งผ่าน API เดิม — {selected.size} รายการ
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleBulkAssign} disabled={bulkSaving || !bulkMenu}>
              {bulkSaving ? 'กำลังบันทึก...' : 'ยืนยันกำหนด'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
