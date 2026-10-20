'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { EmptyState } from '@/components/admin/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldError, FieldHint, Input, Label, Textarea } from '@/components/ui/field';
import {
  createCannedResponse,
  deleteCannedResponse,
  fetchCannedResponses,
  updateCannedResponse,
} from '@/app/admin/chat/_lib/api';
import type { CannedResponse } from '@/app/admin/chat/_lib/types';

export function CannedResponsesClient() {
  const [items, setItems] = useState<CannedResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const rows = await fetchCannedResponses();
    if (rows) {
      setItems(rows);
      setLoadError(null);
    } else {
      setItems([]);
      setLoadError('โหลดข้อมูลไม่สำเร็จ');
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await fetchCannedResponses();
      if (cancelled) return;
      if (rows) {
        setItems(rows);
        setLoadError(null);
      } else {
        setItems([]);
        setLoadError('โหลดข้อมูลไม่สำเร็จ');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startCreate = () => {
    setEditingId(null);
    setTitle('');
    setShortcut('');
    setContent('');
    setError(null);
    setFormOpen(true);
  };

  const startEdit = (item: CannedResponse) => {
    setEditingId(item.id);
    setTitle(item.title);
    setShortcut(item.shortcut ?? '');
    setContent(item.content);
    setError(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim() || busy) return;
    setBusy(true);
    setError(null);
    const body = {
      title: title.trim(),
      shortcut: shortcut.trim() || undefined,
      content: content.trim(),
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
    void reload();
  };

  const handleDelete = async (id: string) => {
    if (busy) return;
    setBusy(true);
    const ok = await deleteCannedResponse(id);
    setBusy(false);
    if (!ok) {
      setError('ลบไม่สำเร็จ');
      return;
    }
    if (editingId === id) setFormOpen(false);
    void reload();
  };

  return (
    <div className="space-y-4">
      <AdminCard>
        <AdminCardTitle
          icon={<Zap className="h-4 w-4" />}
          action={
            <Button type="button" size="sm" onClick={startCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              เพิ่มข้อความด่วน
            </Button>
          }
        >
          ข้อความด่วน {items !== null && `(${items.length.toLocaleString('th-TH')})`}
        </AdminCardTitle>

        <p className="mb-3 text-sm text-muted">
          เรียกใช้ในช่องพิมพ์ของหน้าแชทด้วย &quot;/&quot; ตามด้วยคีย์ลัดหรือชื่อ
        </p>

        {loadError && (
          <p role="status" className="mb-3 text-sm text-danger">
            {loadError}
          </p>
        )}

        {items === null ? (
          <p className="py-10 text-center text-sm text-muted">กำลังโหลด...</p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="ยังไม่มีข้อความด่วน"
            description="กดปุ่มเพิ่มข้อความด่วนเพื่อสร้างข้อความที่ใช้บ่อย"
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <span className="truncate">{item.title}</span>
                    {item.shortcut && (
                      <code className="rounded-sm bg-accent-sunken px-1.5 py-0.5 text-[10px] font-bold text-accent-strong">
                        /{item.shortcut}
                      </code>
                    )}
                  </p>
                  <p className="line-clamp-2 text-xs text-muted">{item.content}</p>
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  aria-label={`แก้ไข ${item.title}`}
                  className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-md text-muted hover:bg-accent-sunken hover:text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(item.id)}
                  aria-label={`ลบ ${item.title}`}
                  className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-md text-muted hover:bg-danger-soft hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-danger"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'แก้ไขข้อความด่วน' : 'เพิ่มข้อความด่วน'}</DialogTitle>
            <DialogDescription>ข้อความที่ใช้บ่อยในช่องพิมพ์ของหน้าแชท</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="canned-title">ชื่อ</Label>
              <Input
                id="canned-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เช่น ทักทายเปิดเรื่อง"
              />
            </div>
            <div>
              <Label htmlFor="canned-shortcut">คีย์ลัด (ไม่บังคับ)</Label>
              <Input
                id="canned-shortcut"
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value)}
                placeholder="เช่น hello"
              />
              <FieldHint>ใช้พิมพ์ /{shortcut.trim() || 'คีย์ลัด'} ในช่องข้อความ</FieldHint>
            </div>
            <div>
              <Label htmlFor="canned-content">เนื้อหา</Label>
              <Textarea
                id="canned-content"
                rows={3}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="ข้อความที่จะส่งถึงผู้ใช้"
              />
            </div>
            <FieldError>{error}</FieldError>
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setFormOpen(false)}>
                ยกเลิก
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!title.trim() || !content.trim() || busy}
                onClick={() => void handleSave()}
              >
                {editingId ? 'บันทึกการแก้ไข' : 'เพิ่ม'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
