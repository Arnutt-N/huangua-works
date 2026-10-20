'use client';

import { useState } from 'react';
import type { IntentItem, IntentMatchType } from '@/app/admin/_lib/admin-api';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import { Plus, Pencil, Trash2, Bot } from 'lucide-react';
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

const MATCH_LABELS: Record<IntentMatchType, string> = {
  exact: 'ตรงทั้งหมด',
  starts_with: 'ขึ้นต้น',
  contains: 'มีคำนี้',
  regex: 'regex',
};

const MATCH_TYPES: IntentMatchType[] = ['exact', 'starts_with', 'contains', 'regex'];

interface IntentForm {
  name: string;
  description: string;
  keywords: string;
  matchType: IntentMatchType;
  response: string;
  isActive: boolean;
}

const EMPTY_FORM: IntentForm = {
  name: '',
  description: '',
  keywords: '',
  matchType: 'contains',
  response: '',
  isActive: true,
};

function readinessOf(item: IntentItem): { ready: boolean; reason: string } {
  if (item.keywords.length === 0) return { ready: false, reason: 'ยังไม่มี keyword' };
  if (item.responses.length === 0) return { ready: false, reason: 'ยังไม่มีคำตอบ' };
  return { ready: true, reason: 'พร้อม' };
}

export function IntentSection() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<IntentForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const { data, loading, feedback, notify, mutate } = useResource({
    load: adminApi.listIntents,
  });
  const items = data?.items ?? [];

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(item: IntentItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description ?? '',
      keywords: item.keywords.map((k) => k.keyword).join(', '),
      matchType: item.keywords[0]?.matchType ?? 'contains',
      response: item.responses.find((r) => r.replyType === 'text')?.textContent ?? '',
      isActive: item.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      notify('error', 'กรุณากรอกชื่อหมวด');
      return;
    }
    const keywords = form.keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
      .map((keyword) => ({ keyword, matchType: form.matchType }));
    if (keywords.length === 0) {
      notify('error', 'กรุณากรอก keyword อย่างน้อย 1 คำ');
      return;
    }
    if (!form.response.trim()) {
      notify('error', 'กรุณากรอกคำตอบอย่างน้อย 1 ข้อ');
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      isActive: form.isActive,
      keywords,
      responses: [{ replyType: 'text' as const, textContent: form.response.trim(), displayOrder: 0 }],
    };
    setSaving(true);
    const ok = await mutate(
      () => (editingId ? adminApi.updateIntent(editingId, payload) : adminApi.createIntent(payload)),
      editingId ? 'แก้ไขหมวดสำเร็จ' : 'เพิ่มหมวดสำเร็จ',
    );
    setSaving(false);
    if (ok) setDialogOpen(false);
  }

  async function handleDelete(item: IntentItem) {
    if (!confirm(`ลบหมวด "${item.name}" ?`)) return;
    await mutate(() => adminApi.deleteIntent(item.id), 'ลบหมวดแล้ว');
  }

  return (
    <>
      {feedback && (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            feedback.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          }`}
        >
          {feedback.msg}
        </div>
      )}
      <AdminCard>
        <AdminCardTitle
          icon={<Bot className="h-4 w-4" />}
          action={
            <Button onClick={openCreate} className="min-h-touch gap-1.5">
              <Plus className="h-4 w-4" />
              เพิ่มหมวด
            </Button>
          }
        >
          หมวดเจตนา ({items.length})
        </AdminCardTitle>

        <p className="mb-3 text-sm text-muted">
          บอทจับคู่ข้อความตามลำดับ exact → ขึ้นต้น → มีคำนี้ → regex หมวดที่ไม่มี keyword
          หรือคำตอบจะไม่ถูกเปิดใช้
        </p>

        {loading ? (
          <div className="py-12 text-center text-muted">กำลังโหลด...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-muted">
            ยังไม่มีหมวดเจตนา — กด &quot;เพิ่มหมวด&quot; เพื่อเริ่มสร้าง
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted">
                  <th className="px-3 py-2 font-medium">หมวด</th>
                  <th className="px-3 py-2 font-medium">Keywords</th>
                  <th className="px-3 py-2 text-center font-medium">ตอบ</th>
                  <th className="px-3 py-2 text-center font-medium">พร้อม</th>
                  <th className="px-3 py-2 text-right font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const { ready, reason } = readinessOf(item);
                  return (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-accent/5">
                      <td className="max-w-xs px-3 py-3">
                        <p className="truncate font-medium text-ink">{item.name}</p>
                        {item.description && (
                          <p className="truncate text-xs text-muted">{item.description}</p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {item.keywords.slice(0, 3).map((kw) => (
                            <span
                              key={kw.id}
                              className="rounded bg-accent-sunken px-1.5 py-0.5 text-xs text-accent-strong"
                              title={MATCH_LABELS[kw.matchType]}
                            >
                              {kw.keyword}
                            </span>
                          ))}
                          {item.keywords.length > 3 && (
                            <span className="text-xs text-muted">+{item.keywords.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums">{item.responses.length}</td>
                      <td className="px-3 py-3 text-center">
                        <span
                          title={reason}
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            ready && item.isActive
                              ? 'bg-success/10 text-success'
                              : 'bg-danger/10 text-danger'
                          }`}
                        >
                          {ready && item.isActive ? 'พร้อม' : 'ไม่พร้อม'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEdit(item)}
                            className="min-h-touch min-w-touch flex items-center justify-center rounded-md hover:bg-accent/10"
                            aria-label={`แก้ไข ${item.name}`}
                          >
                            <Pencil className="h-4 w-4 text-muted" />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="min-h-touch min-w-touch flex items-center justify-center rounded-md hover:bg-danger/10"
                            aria-label={`ลบ ${item.name}`}
                          >
                            <Trash2 className="h-4 w-4 text-danger" />
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
      </AdminCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'แก้ไขหมวด' : 'เพิ่มหมวดใหม่'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="intent-name">ชื่อหมวด *</Label>
              <Input
                id="intent-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="เช่น สอบถามเวลาทำการ"
              />
            </div>

            <div>
              <Label htmlFor="intent-desc">คำอธิบาย</Label>
              <Input
                id="intent-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="เช่น ตอบเรื่องเวลาทำการของ อบต."
              />
            </div>

            <div>
              <Label htmlFor="intent-keywords">Keywords (คั่นด้วย comma) *</Label>
              <Input
                id="intent-keywords"
                value={form.keywords}
                onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
                placeholder="เช่น เปิด, ทำการ, กี่โมง"
              />
            </div>

            <div>
              <Label htmlFor="intent-match">วิธีจับคู่</Label>
              <select
                id="intent-match"
                value={form.matchType}
                onChange={(e) => setForm((f) => ({ ...f, matchType: e.target.value as IntentMatchType }))}
                className="min-h-touch w-full rounded-md border border-border bg-surface-raised px-4 text-ink"
              >
                {MATCH_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {MATCH_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="intent-response">คำตอบ (ข้อความ) *</Label>
              <Textarea
                id="intent-response"
                value={form.response}
                onChange={(e) => setForm((f) => ({ ...f, response: e.target.value }))}
                rows={4}
                placeholder="เช่น เปิดทำการจันทร์-ศุกร์ 08:30-16:30 น."
              />
            </div>

            <label className="flex min-h-touch items-center gap-2">
              <input
                aria-label="ใช้งาน"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="h-5 w-5 rounded border-border accent-accent"
              />
              <span className="text-sm">ใช้งาน</span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
