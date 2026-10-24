'use client';

import { useState } from 'react';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/admin/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DetailModal } from '@/components/admin/detail-modal';
import { PageHeader } from '@/components/admin/page-header';
import { FieldError, Input, Label, Textarea } from '@/components/ui/field';
import { useResource } from '@/app/admin/_lib/use-resource';
import {
  createCannedResponse,
  deleteCannedResponse,
  fetchCannedResponses,
  updateCannedResponse,
} from '@/app/admin/chat/_lib/api';
import type { CannedResponse } from '@/app/admin/chat/_lib/types';

// § key ตรงกับ CANNED_RESPONSE_CATEGORIES ใน src/lib/validation.ts — label ไทยอยู่ที่ UI เท่านั้น
const CATEGORY_OPTIONS = [
  { value: 'info', label: 'ข้อมูลทั่วไป' },
  { value: 'greeting', label: 'ทักทาย' },
  { value: 'closing', label: 'ปิดการสนทนา' },
  { value: 'escalation', label: 'ส่งต่อ/ยกระดับ' },
] as const;

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((c) => [c.value, c.label]),
);

const SHORTCUT_MAX = 30;

function categoryLabel(value: string | undefined): string {
  if (!value) return '—';
  return CATEGORY_LABEL[value] ?? value;
}

export function CannedResponsesClient() {
  const { data, loading, notify, reload } = useResource({
    // § ห่อ raw array จาก chat api ให้เป็น ApiResult — ยังใช้ useResource ตัวเดียวกับหน้าอื่น
    load: async () => {
      const rows = await fetchCannedResponses(true);
      return rows
        ? { ok: true as const, data: { items: rows } }
        : { ok: false as const, error: 'โหลดข้อมูลไม่สำเร็จ', status: 0 };
    },
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<string>('info');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewRow, setViewRow] = useState<CannedResponse | null>(null);

  const startCreate = () => {
    setEditingId(null);
    setTitle('');
    setShortcut('');
    setContent('');
    setCategory('info');
    setError(null);
    setFormOpen(true);
  };

  const startEdit = (item: CannedResponse) => {
    setEditingId(item.id);
    setTitle(item.title);
    setShortcut(item.shortcut ?? '');
    setContent(item.content);
    setCategory(item.category ?? 'info');
    setError(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !shortcut.trim() || !content.trim() || busy) return;
    setBusy(true);
    setError(null);
    const body = {
      title: title.trim(),
      shortcut: shortcut.trim(),
      content: content.trim(),
      category,
    };
    const result = editingId
      ? await updateCannedResponse(editingId, body)
      : await createCannedResponse(body);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'บันทึกไม่สำเร็จ');
      return;
    }
    setFormOpen(false);
    await reload();
  };

  const handleToggleActive = async (item: CannedResponse) => {
    const isActive = !(item.isActive ?? true);
    const result = await updateCannedResponse(item.id, { isActive });
    if (!result.ok) {
      notify('error', result.error ?? 'อัปเดตสถานะไม่สำเร็จ');
      return;
    }
    await reload();
  };

  const handleDelete = async (item: CannedResponse) => {
    if (busy) return;
    // § ลบแบบ soft-delete — confirm ก่อนทุกครั้งเหมือนหน้าอื่น (keyword/response/alias)
    if (!confirm(`ลบ "${item.title}" ?`)) return;
    setBusy(true);
    const ok = await deleteCannedResponse(item.id);
    setBusy(false);
    if (!ok) {
      notify('error', 'ลบไม่สำเร็จ');
      return;
    }
    if (editingId === item.id) setFormOpen(false);
    await reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="ข้อความสำเร็จรูป"
        subtitle="จัดการชุดข้อความที่เจ้าหน้าที่เรียกใช้เร็วในแชทสดด้วยเครื่องหมาย /"
      >
        <Button size="sm" onClick={startCreate} className="gap-1.5">
          <Plus className="h-4 w-4" aria-hidden="true" />
          เพิ่มข้อความ
        </Button>
      </PageHeader>

      {loading ? (
        // § skeleton เป็น div นอก <table> — lint jsx-a11y/control-has-associated-label
        // false-positive กับ <td> ที่ไม่มี text node ตรง ๆ
        <div className="space-y-2 rounded-xl border border-border/50 p-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex animate-pulse gap-3 py-2">
              <div className="h-4 w-20 rounded bg-surface-sunken" />
              <div className="h-4 flex-1 rounded bg-surface-sunken" />
              <div className="h-4 w-16 rounded bg-surface-sunken" />
              <div className="h-4 w-16 rounded bg-surface-sunken" />
              <div className="h-4 w-8 rounded bg-surface-sunken" />
            </div>
          ))}
        </div>
      ) : data === null ? (
        // § โหลดล้มห้ามตก empty state — คนละเรื่องกับ "ว่าง" (data = { items: [] })
        <p role="status" className="py-10 text-center text-sm text-danger">โหลดข้อมูลไม่สำเร็จ</p>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="ยังไม่มีข้อความสำเร็จรูป"
          description="กด “เพิ่มข้อความ” เพื่อเริ่มต้น"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-border/50 text-xs font-semibold uppercase tracking-wide text-muted">
                <th scope="col" className="px-4 py-2.5">ชอร์ตคัต</th>
                <th scope="col" className="px-4 py-2.5">ข้อความ</th>
                <th scope="col" className="px-4 py-2.5 text-center">หมวดหมู่</th>
                <th scope="col" className="px-4 py-2.5 text-center">สถานะ</th>
                <th scope="col" className="px-4 py-2.5 text-center">ใช้ไป</th>
                <th scope="col" className="px-4 py-2.5 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {data.items.map((item) => {
                const isActive = item.isActive ?? true;
                return (
                  <tr key={item.id} className="align-top hover:bg-accent/5">
                    <td className="whitespace-nowrap px-4 py-3">
                      {item.shortcut ? (
                        <code className="rounded-sm bg-accent-sunken px-1.5 py-0.5 font-mono text-xs font-bold text-accent-strong">
                          /{item.shortcut}
                        </code>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="max-w-md px-4 py-3">
                      <p className="text-sm font-medium text-ink">{item.title}</p>
                      <p className="line-clamp-2 text-xs text-muted">{item.content}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      <span className="rounded-pill bg-surface-sunken px-2 py-0.5 text-xs font-medium text-ink">
                        {categoryLabel(item.category)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      <span
                        className={`inline-block rounded-pill px-2 py-0.5 text-xs font-medium ${
                          isActive ? 'bg-success/10 text-success' : 'bg-surface-sunken text-muted'
                        }`}
                      >
                        {isActive ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-muted">
                      {item.usageCount ?? 0}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewRow(item)}
                          aria-label={`ดูรายละเอียด ${item.title}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-accent-sunken hover:text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          aria-label={`แก้ไข ${item.title}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-accent-sunken hover:text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isActive}
                          aria-label={`${isActive ? 'ปิด' : 'เปิด'}ใช้งาน ${item.title}`}
                          onClick={() => void handleToggleActive(item)}
                          className={`relative inline-flex h-5 w-9 flex-none items-center rounded-pill transition-colors duration-normal ${
                            isActive ? 'bg-accent-strong' : 'bg-surface-sunken'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`inline-block h-4 w-4 rounded-pill bg-white shadow transition-transform duration-normal ${
                              isActive ? 'translate-x-4' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(item)}
                          aria-label={`ลบ ${item.title}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-danger-soft hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-danger"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'แก้ไขข้อความสำเร็จรูป' : 'เพิ่มข้อความสำเร็จรูป'}</DialogTitle>
            <DialogDescription>ข้อความที่ใช้บ่อยในช่องพิมพ์ของหน้าแชท</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="canned-shortcut">
                ชอร์ตคัต{' '}
                <span className="font-normal text-muted">
                  (พิมพ์ /{shortcut.trim() || 'คำ'} เพื่อเรียก)
                </span>
              </Label>
              <Input
                id="canned-shortcut"
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value)}
                placeholder="greeting"
                maxLength={SHORTCUT_MAX}
                required
              />
            </div>
            <div>
              <Label htmlFor="canned-title">ชื่อ</Label>
              <Input
                id="canned-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ข้อความทักทาย"
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="canned-content">เนื้อหา</Label>
              <Textarea
                id="canned-content"
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="สวัสดีค่ะ ยินดีให้บริการค่ะ"
              />
            </div>
            <div>
              <Label htmlFor="canned-category">หมวดหมู่</Label>
              <select
                id="canned-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="min-h-touch w-full rounded-md border border-border bg-surface-raised px-4 text-ink"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <FieldError>{error}</FieldError>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                size="sm"
                disabled={!title.trim() || !shortcut.trim() || !content.trim() || busy}
                onClick={() => void handleSave()}
              >
                {editingId ? 'บันทึก' : 'เพิ่ม'}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setFormOpen(false)}>
                ยกเลิก
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DetailModal
        title="รายละเอียดข้อความสำเร็จรูป"
        open={viewRow !== null}
        onClose={() => setViewRow(null)}
        rows={
          viewRow
            ? [
                {
                  label: 'ชอร์ตคัต',
                  value: (
                    <span className="font-mono font-semibold text-accent-strong">
                      /{viewRow.shortcut ?? '—'}
                    </span>
                  ),
                },
                { label: 'ชื่อ', value: viewRow.title },
                {
                  label: 'ข้อความ',
                  value: <span className="whitespace-pre-wrap">{viewRow.content}</span>,
                },
                {
                  label: 'สถานะ',
                  value: (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="rounded-pill bg-surface-sunken px-2 py-0.5 text-xs font-medium text-ink">
                        {categoryLabel(viewRow.category)}
                      </span>
                      <span
                        className={`rounded-pill px-2 py-0.5 text-xs font-medium ${
                          (viewRow.isActive ?? true)
                            ? 'bg-success/10 text-success'
                            : 'bg-surface-sunken text-muted'
                        }`}
                      >
                        {(viewRow.isActive ?? true) ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
                      </span>
                    </span>
                  ),
                },
              ]
            : []
        }
      />
    </div>
  );
}
