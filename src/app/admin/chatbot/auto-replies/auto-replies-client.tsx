'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, MessageCircleQuestion } from 'lucide-react';
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

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  priority: number;
  isActive: boolean;
  hitCount: number;
  createdAt: string;
}

interface FaqForm {
  question: string;
  answer: string;
  keywords: string;
  priority: number;
  isActive: boolean;
}

const EMPTY_FORM: FaqForm = { question: '', answer: '', keywords: '', priority: 0, isActive: true };

export function AutoRepliesClient() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FaqForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const notify = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchItems = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (q) params.set('q', q);
      const res = await fetch(`/api/line/admin/faq?${params}`);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    } catch {
      notify('error', 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const t = setTimeout(() => fetchItems(search || undefined), 300);
    return () => clearTimeout(t);
  }, [search, fetchItems]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(item: FaqItem) {
    setEditingId(item.id);
    setForm({
      question: item.question,
      answer: item.answer,
      keywords: item.keywords.join(', '),
      priority: item.priority,
      isActive: item.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.question.trim() || !form.answer.trim()) {
      notify('error', 'กรุณากรอกคำถามและคำตอบ');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        question: form.question.trim(),
        answer: form.answer.trim(),
        keywords: form.keywords.split(',').map((k) => k.trim()).filter(Boolean),
        priority: form.priority,
        isActive: form.isActive,
      };

      const url = editingId ? `/api/line/admin/faq/${editingId}` : '/api/line/admin/faq';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'บันทึกไม่สำเร็จ');
      }

      notify('success', editingId ? 'แก้ไข FAQ สำเร็จ' : 'เพิ่ม FAQ สำเร็จ');
      setDialogOpen(false);
      fetchItems(search || undefined);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: FaqItem) {
    if (!confirm(`ปิดใช้งาน "${item.question}" ?`)) return;
    try {
      const res = await fetch(`/api/line/admin/faq/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      notify('success', 'ปิดใช้งาน FAQ แล้ว');
      fetchItems(search || undefined);
    } catch {
      notify('error', 'ลบไม่สำเร็จ');
    }
  }

  return (
    <>
      {feedback && (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-success/10 text-success'
              : 'bg-danger/10 text-danger'
          }`}
        >
          {feedback.msg}
        </div>
      )}
      <AdminCard>
        <AdminCardTitle
          icon={<MessageCircleQuestion className="h-4 w-4" />}
          action={
            <Button onClick={openCreate} className="min-h-touch gap-1.5">
              <Plus className="h-4 w-4" />
              เพิ่ม FAQ
            </Button>
          }
        >
          รายการ FAQ ({total})
        </AdminCardTitle>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="ค้นหาคำถามหรือคำตอบ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-touch w-full rounded-lg border border-border bg-surface pl-10 pr-4 text-base outline-none focus:ring-2 focus:ring-accent/40"
            aria-label="ค้นหา FAQ"
          />
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted">กำลังโหลด...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-muted">
            ยังไม่มี FAQ — กด "เพิ่ม FAQ" เพื่อเริ่มสร้าง
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted">
                  <th className="px-3 py-2 font-medium">คำถาม</th>
                  <th className="px-3 py-2 font-medium">Keywords</th>
                  <th className="px-3 py-2 text-center font-medium">Hit</th>
                  <th className="px-3 py-2 text-center font-medium">ลำดับ</th>
                  <th className="px-3 py-2 text-center font-medium">สถานะ</th>
                  <th className="px-3 py-2 text-right font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-accent/5">
                    <td className="max-w-xs px-3 py-3">
                      <p className="truncate font-medium text-ink">{item.question}</p>
                      <p className="truncate text-xs text-muted">{item.answer}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {item.keywords.slice(0, 3).map((kw) => (
                          <span
                            key={kw}
                            className="rounded bg-accent-sunken px-1.5 py-0.5 text-xs text-accent-strong"
                          >
                            {kw}
                          </span>
                        ))}
                        {item.keywords.length > 3 && (
                          <span className="text-xs text-muted">+{item.keywords.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums">{item.hitCount}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{item.priority}</td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.isActive
                            ? 'bg-success/10 text-success'
                            : 'bg-danger/10 text-danger'
                        }`}
                      >
                        {item.isActive ? 'ใช้งาน' : 'ปิด'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(item)}
                          className="min-h-touch min-w-touch flex items-center justify-center rounded-md hover:bg-accent/10"
                          aria-label={`แก้ไข ${item.question}`}
                        >
                          <Pencil className="h-4 w-4 text-muted" />
                        </button>
                        {item.isActive && (
                          <button
                            onClick={() => handleDelete(item)}
                            className="min-h-touch min-w-touch flex items-center justify-center rounded-md hover:bg-danger/10"
                            aria-label={`ปิดใช้งาน ${item.question}`}
                          >
                            <Trash2 className="h-4 w-4 text-danger" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'แก้ไข FAQ' : 'เพิ่ม FAQ ใหม่'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="faq-question">คำถาม *</Label>
              <Input
                id="faq-question"
                value={form.question}
                onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                placeholder="เช่น เปิดทำการกี่โมง?"
              />
            </div>

            <div>
              <Label htmlFor="faq-answer">คำตอบ *</Label>
              <Textarea
                id="faq-answer"
                value={form.answer}
                onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                rows={4}
                placeholder="เช่น เปิดทำการจันทร์-ศุกร์ 08:30-16:30 น."
              />
            </div>

            <div>
              <Label htmlFor="faq-keywords">Keywords (คั่นด้วย comma)</Label>
              <Input
                id="faq-keywords"
                value={form.keywords}
                onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
                placeholder="เช่น เปิด, ทำการ, เวลา, กี่โมง"
              />
            </div>

            <div className="flex gap-4">
              <div>
                <Label htmlFor="faq-priority">ลำดับความสำคัญ (0-100)</Label>
                <Input
                  id="faq-priority"
                  type="number"
                  min={0}
                  max={100}
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                  className="w-24"
                />
              </div>

              <label className="flex min-h-touch items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-5 w-5 rounded border-border accent-accent"
                />
                <span className="text-sm">ใช้งาน</span>
              </label>
            </div>
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
