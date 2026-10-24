'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { IntentItem, IntentMatchType } from '@/app/admin/_lib/admin-api';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { readinessOf } from './readiness';
import { useResource } from '@/app/admin/_lib/use-resource';
import { Plus, Pencil, Trash2, Bot, Eye } from 'lucide-react';
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

interface KeywordRow {
  keyword: string;
  matchType: IntentMatchType;
}

interface ResponseRow {
  replyType: 'text' | 'reply_object';
  textContent: string;
  replyObjectId: string;
}

interface IntentForm {
  name: string;
  description: string;
  keywordRows: KeywordRow[];
  responseRows: ResponseRow[];
  isActive: boolean;
}

function emptyForm(): IntentForm {
  return {
    name: '',
    description: '',
    keywordRows: [{ keyword: '', matchType: 'contains' }],
    responseRows: [{ replyType: 'text', textContent: '', replyObjectId: '' }],
    isActive: true,
  };
}

export function IntentSection() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<IntentForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IntentItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data, loading, feedback, notify, mutate, reload } = useResource({
    load: adminApi.listIntents,
  });
  const items = data?.items ?? [];

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  // § เติมค่าจริงครบทุก keyword/response จาก item — เดิมยุบ matchType เหลือตัวแรก
  // และทิ้ง reply_object จนกดบันทึกแล้วข้อมูลหายเงียบ
  function openEdit(item: IntentItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description ?? '',
      keywordRows:
        item.keywords.length > 0
          ? item.keywords.map((k) => ({ keyword: k.keyword, matchType: k.matchType }))
          : [{ keyword: '', matchType: 'contains' }],
      responseRows:
        item.responses.length > 0
          ? item.responses.map((r) => ({
              replyType: r.replyType,
              textContent: r.textContent ?? '',
              replyObjectId: r.replyObjectId ?? '',
            }))
          : [{ replyType: 'text', textContent: '', replyObjectId: '' }],
      isActive: item.isActive,
    });
    setDialogOpen(true);
  }

  /**
   * mode: 'configure' = สร้างแล้วเปิดหน้า detail ตั้งค่าต่อ (jsk ปุ่ม "สร้างและตั้งค่าต่อ"),
   * 'only' = สร้างเสร็จปิด dialog (jsk "สร้างอย่างเดียว"), 'save' = แก้ไขแบบเดิม
   */
  async function handleSave(mode: 'configure' | 'only' | 'save' = 'save') {
    if (!form.name.trim()) {
      notify('error', 'กรุณากรอกชื่อหมวด');
      return;
    }
    const keywords = form.keywordRows
      .map((r) => ({ keyword: r.keyword.trim(), matchType: r.matchType }))
      .filter((r) => r.keyword.length > 0);
    if (keywords.length === 0) {
      notify('error', 'กรุณากรอก keyword อย่างน้อย 1 คำ');
      return;
    }
    const responses = form.responseRows
      .map((r, i) => ({
        replyType: r.replyType,
        textContent: r.replyType === 'text' ? r.textContent.trim() || null : null,
        replyObjectId: r.replyType === 'reply_object' ? r.replyObjectId.trim() || null : null,
        displayOrder: i,
      }))
      .filter((r) => (r.replyType === 'text' ? r.textContent !== null : r.replyObjectId !== null));
    if (responses.length === 0) {
      notify('error', 'กรุณากรอกคำตอบอย่างน้อย 1 ข้อ');
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      isActive: form.isActive,
      keywords,
      responses,
    };
    setSaving(true);
    const res = editingId
      ? await adminApi.updateIntent(editingId, payload)
      : await adminApi.createIntent(payload);
    if (res.ok) {
      notify('success', editingId ? 'แก้ไขหมวดสำเร็จ' : 'เพิ่มหมวดสำเร็จ');
      setDialogOpen(false);
      // § union ของ update คืน OkBody ไม่มี id — narrow ด้วย 'in' ก่อนใช้
      if (!editingId && mode === 'configure' && 'id' in res.data && res.data.id) {
        // § ไปหน้า detail ตั้งค่าต่อ
        router.push(`/admin/chatbot/auto-replies/${res.data.id}`);
        return;
      }
      await reload();
    } else {
      notify('error', res.error);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await mutate(() => adminApi.deleteIntent(deleteTarget.id), 'ลบหมวดแล้ว');
    setDeleting(false);
    setDeleteTarget(null);
  }

  async function handleToggle(item: IntentItem) {
    const res = await adminApi.updateIntent(item.id, { isActive: !item.isActive });
    if (!res.ok) {
      notify('error', res.error);
      return;
    }
    notify('success', item.isActive ? 'ปิดหมวดแล้ว' : 'เปิดหมวดแล้ว');
    await reload();
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
              New Category
            </Button>
          }
        >
          Intent Categories
        </AdminCardTitle>

        <p className="mb-3 text-sm text-muted">
          บอทจับคู่ข้อความตามลำดับ exact → ขึ้นต้น → มีคำนี้ → regex หมวดที่ไม่มี keyword
          หรือคำตอบจะไม่ถูกเปิดใช้
        </p>

        {loading ? (
          <div className="py-12 text-center text-muted">กำลังโหลด...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-muted">
            ยังไม่มีหมวดเจตนา — กด &quot;New Category&quot; เพื่อเริ่มสร้าง
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted">
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Keywords</th>
                  {/* § ตามภาพ jsk — คอลัมน์สถานะเป็นสวิตช์เปิด/ปิด ไม่ใช่ badge ข้อความ
                      และตัดคอลัมน์ "ตอบ" ออกเพราะจำนวนคำตอบดูได้ในหน้า detail */}
                  <th className="px-3 py-2 text-center font-medium">สถานะ</th>
                  <th className="px-3 py-2 text-right font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const { reason } = readinessOf(item);
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
                      <td className="px-3 py-3 text-center">
                        {/* § สวิตช์เปิด/ปิด — role="switch" ให้ a11y อ่านถูกและเทสต์จับได้
                            title = reason จาก readinessOf บอกว่าทำไมยังไม่พร้อม */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={item.isActive}
                          aria-label={`${item.isActive ? 'ปิด' : 'เปิด'} ${item.name}`}
                          title={reason}
                          onClick={() => handleToggle(item)}
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
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <Link
                            href={`/admin/chatbot/auto-replies/${item.id}`}
                            className="flex min-h-touch min-w-touch items-center justify-center rounded-md hover:bg-accent/10"
                            aria-label={`ดู ${item.name}`}
                          >
                            <Eye className="h-4 w-4 text-muted" />
                          </Link>
                          <button
                            onClick={() => openEdit(item)}
                            className="min-h-touch min-w-touch flex items-center justify-center rounded-md hover:bg-accent/10"
                            aria-label={`แก้ไข ${item.name}`}
                          >
                            <Pencil className="h-4 w-4 text-muted" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(item)}
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

      {/* § ConfirmDialog แทน window.confirm — ตาม jsk และคุมข้อความ/ปุ่มได้ */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ลบหมวดเจตนา</DialogTitle>
          </DialogHeader>
          <p className="py-2 text-sm text-muted">
            ลบ &quot;{deleteTarget?.name}&quot;? คำตอบของหมวดนี้จะหายไปด้วย
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>ยกเลิก</Button>
            <Button
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="bg-danger text-on-accent hover:bg-danger/90"
            >
              {deleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'แก้ไขหมวด' : 'เพิ่ม Category ใหม่'}</DialogTitle>
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
              <Label id="intent-keywords-label">Keywords *</Label>
              <div className="space-y-2" role="group" aria-labelledby="intent-keywords-label">
                {form.keywordRows.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      aria-label={`keyword ที่ ${i + 1}`}
                      value={row.keyword}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          keywordRows: f.keywordRows.map((r, j) =>
                            j === i ? { ...r, keyword: e.target.value } : r,
                          ),
                        }))
                      }
                      placeholder="เช่น กี่โมง"
                      className="flex-1"
                    />
                    <select
                      aria-label={`วิธีจับคู่ keyword ที่ ${i + 1}`}
                      value={row.matchType}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          keywordRows: f.keywordRows.map((r, j) =>
                            j === i ? { ...r, matchType: e.target.value as IntentMatchType } : r,
                          ),
                        }))
                      }
                      className="min-h-touch rounded-md border border-border bg-surface-raised px-2 text-sm text-ink"
                    >
                      {MATCH_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {MATCH_LABELS[t]}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="ghost"
                      aria-label={`ลบ keyword ที่ ${i + 1}`}
                      disabled={form.keywordRows.length <= 1}
                      onClick={() =>
                        setForm((f) => ({ ...f, keywordRows: f.keywordRows.filter((_, j) => j !== i) }))
                      }
                    >
                      ลบ
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                className="mt-2 gap-1"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    keywordRows: [...f.keywordRows, { keyword: '', matchType: 'contains' }],
                  }))
                }
              >
                <Plus className="h-4 w-4" />
                เพิ่ม keyword
              </Button>
            </div>

            <div>
              <Label id="intent-responses-label">คำตอบ *</Label>
              <div className="space-y-2" role="group" aria-labelledby="intent-responses-label">
                {form.responseRows.map((row, i) => (
                  <div key={i} className="space-y-2 rounded-md border border-border/50 p-2">
                    <div className="flex gap-2">
                      <select
                        aria-label={`ชนิดคำตอบที่ ${i + 1}`}
                        value={row.replyType}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            responseRows: f.responseRows.map((r, j) =>
                              j === i
                                ? { ...r, replyType: e.target.value as 'text' | 'reply_object' }
                                : r,
                            ),
                          }))
                        }
                        className="min-h-touch rounded-md border border-border bg-surface-raised px-2 text-sm text-ink"
                      >
                        <option value="text">ข้อความ</option>
                        <option value="reply_object">reply object</option>
                      </select>
                      <Button
                        variant="ghost"
                        aria-label={`ลบคำตอบที่ ${i + 1}`}
                        disabled={form.responseRows.length <= 1}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            responseRows: f.responseRows.filter((_, j) => j !== i),
                          }))
                        }
                      >
                        ลบ
                      </Button>
                    </div>
                    {row.replyType === 'text' ? (
                      <Textarea
                        aria-label={`ข้อความคำตอบที่ ${i + 1}`}
                        value={row.textContent}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            responseRows: f.responseRows.map((r, j) =>
                              j === i ? { ...r, textContent: e.target.value } : r,
                            ),
                          }))
                        }
                        rows={3}
                        placeholder="เช่น เปิดทำการจันทร์-ศุกร์ 08:30-16:30 น."
                      />
                    ) : (
                      <Input
                        aria-label={`reply object id คำตอบที่ ${i + 1}`}
                        value={row.replyObjectId}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            responseRows: f.responseRows.map((r, j) =>
                              j === i ? { ...r, replyObjectId: e.target.value } : r,
                            ),
                          }))
                        }
                        placeholder="เช่น reply-object id"
                      />
                    )}
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                className="mt-2 gap-1"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    responseRows: [
                      ...f.responseRows,
                      { replyType: 'text', textContent: '', replyObjectId: '' },
                    ],
                  }))
                }
              >
                <Plus className="h-4 w-4" />
                เพิ่มคำตอบ
              </Button>
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
            {editingId ? (
              <Button onClick={() => void handleSave('save')} disabled={saving}>
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            ) : (
              /* § ปุ่มคู่ตาม jsk dialog "เพิ่ม Category" — สร้างแล้วเปิดหน้าตั้งค่าต่อ / สร้างจบ */
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => void handleSave('only')} disabled={saving}>
                  สร้างอย่างเดียว
                </Button>
                <Button onClick={() => void handleSave('configure')} disabled={saving}>
                  สร้างและตั้งค่าต่อ
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
