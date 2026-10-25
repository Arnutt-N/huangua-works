'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { adminApi, type ReplyObject } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { DetailModal } from '@/components/admin/detail-modal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { typeBadgeClass } from './reply-preview';
import {
  EMPTY_REPLY_OBJECT_FORM,
  ReplyObjectForm,
  type ReplyObjectFormData,
} from './_components/reply-object-form';

export function ReplyObjectsClient() {
  const { data, loading, notify, reload } = useResource({ load: adminApi.listReplyObjects });
  const items = data?.items ?? null;

  const [editing, setEditing] = useState<ReplyObject | null>(null);
  const [viewObj, setViewObj] = useState<ReplyObject | null>(null);

  async function handleEditSave(form: ReplyObjectFormData): Promise<boolean> {
    if (!editing) return false;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(form.payload);
    } catch {
      notify('error', 'Invalid JSON payload');
      return false;
    }
    const res = await adminApi.updateReplyObject(editing.id, {
      name: form.name.trim(),
      category: form.category.trim() || null,
      objectType: form.objectType,
      payload,
      altText: form.altText || null,
      isActive: editing.isActive,
    });
    if (!res.ok) {
      notify('error', res.error);
      return false;
    }
    setEditing(null);
    await reload();
    return true;
  }

  async function handleToggleActive(item: ReplyObject) {
    const res = await adminApi.updateReplyObject(item.id, {
      objectType: item.objectType,
      payload: item.payload,
      altText: item.altText,
      isActive: !item.isActive,
    });
    if (!res.ok) {
      notify('error', res.error);
      return;
    }
    await reload();
  }

  async function handleDelete(item: ReplyObject) {
    if (!confirm(`ลบ "$${item.objectId}" ?`)) return;
    const res = await adminApi.deleteReplyObject(item.id);
    if (!res.ok) {
      notify('error', res.error);
      return;
    }
    await reload();
  }

  const editInitial: ReplyObjectFormData | null = editing
    ? {
        objectId: editing.objectId,
        name: editing.name ?? '',
        category: editing.category ?? '',
        objectType: editing.objectType,
        payload: JSON.stringify(editing.payload, null, 2),
        altText: editing.altText ?? '',
      }
    : EMPTY_REPLY_OBJECT_FORM;

  return (
    <div className="space-y-6">
      <PageHeader title="Reply Objects" subtitle="Manage reusable message templates">
        <Link href="/admin/chatbot/reply-objects/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Template
          </Button>
        </Link>
      </PageHeader>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-border/50 p-6">
              <div className="h-4 w-24 animate-pulse rounded bg-surface-sunken" />
              <div className="h-5 w-40 animate-pulse rounded bg-surface-sunken" />
              <div className="h-3 w-20 animate-pulse rounded bg-surface-sunken" />
            </div>
          ))}
        </div>
      ) : data === null ? (
        <p role="status" className="py-10 text-center text-sm text-danger">โหลดข้อมูลไม่สำเร็จ</p>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="ยังไม่มี reply object"
          description="สร้างเทมเพลตแรกเพื่อใช้ซ้ำใน FAQ และ intent responses"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-2xl border border-border/50 p-5 transition-colors hover:border-accent/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold text-accent-strong">$${item.objectId}</p>
                  <h3 className="mt-1 line-clamp-2 text-base font-bold text-ink">
                    {item.name ?? item.objectId}
                  </h3>
                </div>
                <span
                  className={`flex-none rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${typeBadgeClass(item.objectType)}`}
                >
                  {item.objectType}
                </span>
              </div>

              {item.category && (
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {item.category}
                </p>
              )}

              <div className="mt-auto flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setViewObj(item)}
                  aria-label={`ดูรายละเอียด ${item.objectId}`}
                  className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md text-muted hover:bg-accent-sunken hover:text-accent-strong"
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(item)}
                  aria-label={`แก้ไข ${item.objectId}`}
                  className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md text-muted hover:bg-accent-sunken hover:text-accent-strong"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={item.isActive}
                  aria-label={`${item.isActive ? 'ปิด' : 'เปิด'}ใช้งาน ${item.objectId}`}
                  onClick={() => void handleToggleActive(item)}
                  className={`relative inline-flex h-5 w-9 flex-none items-center rounded-pill transition-colors duration-normal ${
                    item.isActive ? 'bg-accent-strong' : 'bg-surface-sunken'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block h-4 w-4 rounded-pill bg-white shadow transition-transform duration-normal ${
                      item.isActive ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(item)}
                  aria-label={`ลบ ${item.objectId}`}
                  className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md text-danger hover:bg-danger-soft"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => (!o ? setEditing(null) : undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Object</DialogTitle>
          </DialogHeader>
          {editInitial && (
            <ReplyObjectForm
              key={editing?.objectId}
              initial={editInitial}
              lockObjectId
              submitLabel="Save Modifications"
              onSave={handleEditSave}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <DetailModal
        title="รายละเอียดเทมเพลต"
        open={viewObj !== null}
        onClose={() => setViewObj(null)}
        rows={
          viewObj
            ? [
                {
                  label: 'รหัส',
                  value: (
                    <span className="font-mono font-semibold text-accent-strong">
                      $${viewObj.objectId}
                    </span>
                  ),
                },
                { label: 'ชื่อ', value: viewObj.name ?? viewObj.objectId },
                { label: 'ประเภท', value: <span className="uppercase">{viewObj.objectType}</span> },
                { label: 'หมวดหมู่', value: viewObj.category || '-' },
              ]
            : []
        }
        renderExtra={
          viewObj ? (
            <div>
              <p className="mb-1 text-xs text-muted">JSON</p>
              <pre className="max-h-64 overflow-auto overscroll-contain rounded-xl bg-[#0f172a] p-4 font-mono text-xs text-[#86efac]">
                {JSON.stringify(viewObj.payload, null, 2)}
              </pre>
            </div>
          ) : undefined
        }
        actions={
          viewObj
            ? [
                {
                  label: 'แก้ไข',
                  variant: 'outline',
                  onClick: () => {
                    const o = viewObj;
                    setViewObj(null);
                    setEditing(o);
                  },
                },
                { label: 'ปิด', onClick: () => setViewObj(null), variant: 'primary' },
              ]
            : undefined
        }
      />
    </div>
  );
}
