'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Trash2, Copy, Image as ImageIcon, FileIcon } from 'lucide-react';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { Button } from '@/components/ui/button';

interface MediaItem {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  createdAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesClient() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const notify = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/line/admin/media');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items);
      setStorageOk(data.storageConfigured);
    } catch {
      notify('error', 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('category', 'general');
      const res = await fetch('/api/line/admin/media', { method: 'POST', body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'อัปโหลดไม่สำเร็จ');
      }
      notify('success', 'อัปโหลดสำเร็จ');
      fetchItems();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete(item: MediaItem) {
    if (!confirm(`ลบ "${item.filename}" ?`)) return;
    try {
      const res = await fetch(`/api/line/admin/media/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      notify('success', 'ลบสำเร็จ');
      fetchItems();
    } catch {
      notify('error', 'ลบไม่สำเร็จ');
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    notify('success', 'คัดลอก URL แล้ว');
  }

  return (
    <>
      {feedback && (
        <div role="status" className={`rounded-lg px-4 py-3 text-sm font-medium ${feedback.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
          {feedback.msg}
        </div>
      )}

      {!storageOk && (
        <div className="rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">
          S3 storage ยังไม่ได้ตั้งค่า — ตั้ง env: S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET
        </div>
      )}

      <AdminCard>
        <AdminCardTitle
          icon={<ImageIcon className="h-4 w-4" />}
          action={
            <>
              <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} accept="image/*,.pdf" />
              <Button onClick={() => fileRef.current?.click()} disabled={uploading || !storageOk} className="min-h-touch gap-1.5">
                <Upload className="h-4 w-4" /> {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลด'}
              </Button>
            </>
          }
        >
          ไฟล์สื่อ ({items.length})
        </AdminCardTitle>

        {loading ? (
          <div className="py-12 text-center text-muted">กำลังโหลด...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-muted">ยังไม่มีไฟล์ — อัปโหลดไฟล์แรก</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <div key={item.id} className="group relative rounded-lg border border-border/50 p-3">
                <div className="mb-2 flex h-20 items-center justify-center rounded bg-surface-raised">
                  {item.mimeType.startsWith('image/') ? (
                    <img src={item.url} alt={item.filename} className="max-h-20 rounded object-contain" />
                  ) : (
                    <FileIcon className="h-8 w-8 text-muted" />
                  )}
                </div>
                <p className="truncate text-xs font-medium text-ink">{item.filename}</p>
                <p className="text-xs text-muted">{formatSize(item.sizeBytes)} · {item.category}</p>
                <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => copyUrl(item.url)} className="min-h-touch min-w-touch flex items-center justify-center rounded hover:bg-accent/10" aria-label="คัดลอก URL">
                    <Copy className="h-3.5 w-3.5 text-muted" />
                  </button>
                  <button onClick={() => handleDelete(item)} className="min-h-touch min-w-touch flex items-center justify-center rounded hover:bg-danger/10" aria-label={`ลบ ${item.filename}`}>
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </>
  );
}
