'use client';

import { useState } from 'react';
import type { ReplyObject } from '@/app/admin/_lib/admin-api';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import { Plus, Pencil, Trash2, LayoutGrid } from 'lucide-react';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label, Input, Textarea } from '@/components/ui/field';

interface FormState {
  objectId: string;
  objectType: string;
  payloadJson: string;
  altText: string;
  isActive: boolean;
}

import { validateReplyPayload, REPLY_OBJECT_TYPES } from '@/lib/line/reply-object-validation';
import { hasQuickReply, payloadSummary, typeBadgeClass } from './reply-preview';

const EMPTY_FORM: FormState = { objectId: '', objectType: 'text', payloadJson: '{}', altText: '', isActive: true };

export function ReplyObjectsClient() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const { data, loading, feedback, notify, mutate } = useResource({
    load: adminApi.listReplyObjects,
  });
  const items = data?.items ?? [];

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(item: ReplyObject) {
    setEditingId(item.id);
    setForm({
      objectId: item.objectId,
      objectType: item.objectType,
      payloadJson: JSON.stringify(item.payload, null, 2),
      altText: item.altText ?? '',
      isActive: item.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.objectId.trim()) {
      notify('error', 'กรุณากรอก Object ID');
      return;
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(form.payloadJson);
    } catch {
      notify('error', 'Payload JSON ไม่ถูกต้อง');
      return;
    }

    // § ชนิดที่ LINE API ไม่รับต้อง fail ตรงนี้ ไม่ใช่ตอนบอทส่ง (PRP T4 risk)
    const payloadError = validateReplyPayload(form.objectType, payload);
    if (payloadError) {
      notify('error', payloadError);
      return;
    }

    // § POST createSchema รับ altText?: string เท่านั้น (null → 400); PATCH updateSchema รับ null ได้
    const createBody = {
      objectId: form.objectId.trim(),
      objectType: form.objectType,
      payload,
      isActive: form.isActive,
      ...(form.altText ? { altText: form.altText } : {}),
    };
    const updateBody = {
      objectType: form.objectType,
      payload,
      altText: form.altText || null,
      isActive: form.isActive,
    };
    setSaving(true);
    const ok = await mutate(
      () =>
        editingId
          ? adminApi.updateReplyObject(editingId, updateBody)
          : adminApi.createReplyObject(createBody),
      editingId ? 'แก้ไขสำเร็จ' : 'สร้างสำเร็จ',
    );
    setSaving(false);
    if (ok) setDialogOpen(false);
  }

  async function handleDelete(item: ReplyObject) {
    if (!confirm(`ลบ "$${item.objectId}" ?`)) return;
    // server คืน 409 { error: 'ไม่สามารถลบได้ — ถูกอ้างอยู่ใน N ที่ …' } — ต้องโชว์ให้เห็น
    await mutate(() => adminApi.deleteReplyObject(item.id), 'ลบสำเร็จ');
  }

  return (
    <>
      {feedback && (
        <div role="status" className={`rounded-lg px-4 py-3 text-sm font-medium ${feedback.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
          {feedback.msg}
        </div>
      )}

      <AdminCard>
        <AdminCardTitle
          icon={<LayoutGrid className="h-4 w-4" />}
          action={<Button onClick={openCreate} className="min-h-touch gap-1.5"><Plus className="h-4 w-4" /> สร้าง</Button>}
        >
          Reply Objects ({items.length})
        </AdminCardTitle>

        {loading ? (
          <div className="py-12 text-center text-muted">กำลังโหลด...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-muted">ยังไม่มี reply object — กด &quot;สร้าง&quot; เพื่อเริ่ม</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border border-border/50 p-4 hover:bg-accent/5"
              >
                <p className="font-mono text-sm font-bold text-accent-strong">
                  $${item.objectId}
                </p>
                <p className="line-clamp-2 min-h-10 text-sm font-medium text-ink">
                  {payloadSummary(item.objectType, item.payload)}
                </p>
                <p className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${typeBadgeClass(item.objectType)}`}
                  >
                    {item.objectType}
                  </span>
                  {hasQuickReply(item.payload) && (
                    <span className="rounded bg-accent-gold-soft px-1.5 py-0.5 text-[10px] font-bold text-warning-ink">
                      quick reply
                    </span>
                  )}
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${item.isActive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}
                  >
                    {item.isActive ? 'ใช้งาน' : 'ปิด'}
                  </span>
                </p>
                {item.altText && (
                  <p className="line-clamp-1 text-xs text-muted">{item.altText}</p>
                )}
                <div className="mt-auto flex justify-end gap-1 pt-1">
                  <button onClick={() => openEdit(item)} className="min-h-touch min-w-touch flex items-center justify-center rounded-md hover:bg-accent/10" aria-label={`แก้ไข ${item.objectId}`}>
                    <Pencil className="h-4 w-4 text-muted" />
                  </button>
                  <button onClick={() => handleDelete(item)} className="min-h-touch min-w-touch flex items-center justify-center rounded-md hover:bg-danger/10" aria-label={`ลบ ${item.objectId}`}>
                    <Trash2 className="h-4 w-4 text-danger" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'แก้ไข Reply Object' : 'สร้าง Reply Object'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!editingId && (
              <div>
                <Label htmlFor="ro-id">Object ID (ใช้ใน $object_id)</Label>
                <Input id="ro-id" value={form.objectId} onChange={(e) => setForm((f) => ({ ...f, objectId: e.target.value }))} placeholder="เช่น welcome_flex" />
              </div>
            )}

            <div>
              <Label htmlFor="ro-type">ประเภท</Label>
              <select
                id="ro-type"
                value={form.objectType}
                onChange={(e) => setForm((f) => ({ ...f, objectType: e.target.value }))}
                className="min-h-touch w-full rounded-md border border-border bg-surface-raised px-4 text-ink"
              >
                {REPLY_OBJECT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="ro-payload">Payload (JSON)</Label>
              <Textarea id="ro-payload" rows={6} value={form.payloadJson} onChange={(e) => setForm((f) => ({ ...f, payloadJson: e.target.value }))} className="font-mono text-sm" />
            </div>

            <div>
              <Label htmlFor="ro-alt">Alt Text</Label>
              <Input id="ro-alt" value={form.altText} onChange={(e) => setForm((f) => ({ ...f, altText: e.target.value }))} placeholder="ข้อความสำรอง (แสดงใน notification)" />
            </div>

            <label className="flex min-h-touch items-center gap-2">
              <input aria-label="ใช้งาน" type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="h-5 w-5 rounded border-border accent-accent" />
              <span className="text-sm">ใช้งาน</span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
