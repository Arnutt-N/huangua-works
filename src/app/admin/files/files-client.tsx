'use client';

import { useRef, useState } from 'react';
import type { MediaItem } from '@/app/admin/_lib/admin-api';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import { Upload, Trash2, Copy, Image as ImageIcon, FileIcon } from 'lucide-react';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { Button } from '@/components/ui/button';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesClient() {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, loading, feedback, notify, mutate } = useResource({
    load: adminApi.listMedia,
  });
  const items = data?.items ?? [];
  const storageOk = data?.storageConfigured ?? true;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await mutate(() => adminApi.uploadMedia(file), 'อัปโหลดสำเร็จ');
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleDelete(item: MediaItem) {
    if (!confirm(`ลบ "${item.filename}" ?`)) return;
    // server คืน { error: 'ไม่พบไฟล์' } — mutate เอาข้อความนั้นมาแจ้ง ไม่โยนทิ้งเหมือนเดิม
    await mutate(() => adminApi.deleteMedia(item.id), 'ลบสำเร็จ');
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
