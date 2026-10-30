'use client';

import { useRef, useState } from 'react';
import type { MediaItem } from '@/app/admin/_lib/admin-api';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import { Upload, Trash2, ExternalLink, Image as ImageIcon, FileIcon } from 'lucide-react';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { AdminErrorState } from '@/components/admin/admin-error-state';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/admin/use-confirm';
import { MEDIA_ACCEPT_ATTR, validateMediaFile } from '@/lib/media-upload-rules';
import { useMediaItemReadUrl } from './use-media-item-read-url';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** § ต้องเป็น component แยกเพื่อเรียก hook ได้ — ห้ามเรียก hook ใน .map() */
function MediaThumb({ item }: { item: MediaItem }) {
  const isImage = item.mimeType.startsWith('image/');
  const url = useMediaItemReadUrl(item.id, isImage);
  return (
    <div className="mb-2 flex h-20 items-center justify-center rounded bg-surface-raised">
      {isImage && url ? (
        /* eslint-disable-next-line @next/next/no-img-element -- รูปจาก storage ภายนอก ไม่ผ่าน Next image optimizer */
        <img src={url} alt={item.filename} className="max-h-20 rounded object-contain" />
      ) : (
        <FileIcon className="h-8 w-8 text-muted" aria-label={isImage ? 'กำลังโหลดรูป' : 'ไฟล์'} />
      )}
    </div>
  );
}

export function FilesClient() {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirm();

  const { data, loading, feedback, error, errorCode, notify, mutate, reload } = useResource({
    load: adminApi.listMedia,
  });
  const items = data?.items ?? [];
  const storageOk = data?.storageConfigured ?? true;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // § FORM-04: ตรวจชนิด/ขนาดก่อนส่ง — กติกาเดียวกับ API (lib/media-upload-rules) ผู้ใช้ไม่ต้องรออัปโหลดแล้วโดนปฏิเสธ
    // เซิร์ฟเวอร์ยังตรวจซ้ำเสมอ ตรงนี้แค่แจ้งเร็วและไม่เปลืองแบนด์วิดท์
    const invalid = validateMediaFile(file);
    if (invalid) {
      notify('error', invalid);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setUploading(true);
    await mutate(() => adminApi.uploadMedia(file), 'อัปโหลดสำเร็จ');
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleDelete(item: MediaItem) {
    // § FORM-06: ใช้กล่องยืนยันมาตรฐานของระบบ แทน window.confirm
    const ok = await confirm({
      title: 'ลบไฟล์',
      description: `ลบ "${item.filename}" ใช่หรือไม่? ลบแล้วกู้คืนไม่ได้`,
      confirmText: 'ลบไฟล์',
      danger: true,
    });
    if (!ok) return;
    // server คืน { error: 'ไม่พบไฟล์' } — mutate เอาข้อความนั้นมาแจ้ง ไม่โยนทิ้งเหมือนเดิม
    await mutate(() => adminApi.deleteMedia(item.id), 'ลบสำเร็จ');
  }

  // § ปุ่ม "คัดลอก URL" เดิมลบออก — URL ที่ได้จาก read-url อายุ 5 นาที
  // ลิงก์ที่คัดลอกไปจะตายก่อนถึงมือผู้รับ จึงเหลือแค่ "เปิด" ที่ขอ URL ใหม่ทุกครั้ง
  // § เปิดหน้าต่างเปล่าก่อน await — window.open หลัง await ถือว่าไม่มี user gesture
  // และถูก popup blocker ตัดทิ้ง (Safari บล็อกแน่นอน, Chrome บ่อย)
  // § ห้ามส่ง 'noreferrer'/'noopener' ใน windowFeatures ตอนเปิดแท็บเปล่า เพราะ HTML spec
  // บังคับให้ window.open คืน null เสมอ — ตั้ง tab.opener = null แทนเพื่อให้ยังถือ ref ไว้เปลี่ยน location/close ได้
  async function openFile(item: MediaItem) {
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    try {
      const res = await fetch(`/api/line/admin/media/${item.id}/read-url`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { url?: unknown };
      if (typeof data.url !== 'string') throw new Error('malformed');
      if (tab) tab.location.href = data.url;
      else window.open(data.url, '_blank', 'noreferrer');
    } catch {
      tab?.close();
      notify('error', 'เปิดไฟล์ไม่ได้ — ลองใหม่อีกครั้ง');
    }
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
              <input aria-label="อัปโหลดไฟล์สื่อ" ref={fileRef} type="file" className="hidden" onChange={handleUpload} accept={MEDIA_ACCEPT_ATTR} />
              <Button onClick={() => fileRef.current?.click()} disabled={uploading || !storageOk} className="min-h-touch gap-1.5">
                <Upload className="h-4 w-4" /> {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลด'}
              </Button>
            </>
          }
        >
          ไฟล์สื่อ ({items.length})
        </AdminCardTitle>

        <p className="mb-3 text-xs text-muted">รองรับไฟล์ภาพ PNG, JPEG, WebP ขนาดไม่เกิน 10MB</p>

        {loading ? (
          <div className="py-12 text-center text-muted">กำลังโหลด...</div>
        ) : data === null && error ? (
          <AdminErrorState error={error} errorCode={errorCode} onRetry={() => void reload()} />
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-muted">ยังไม่มีไฟล์ — อัปโหลดไฟล์แรก</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border border-border/50 p-3">
                <MediaThumb item={item} />
                <p className="truncate text-xs font-medium text-ink">{item.filename}</p>
                <p className="text-xs text-muted">{formatSize(item.sizeBytes)} · {item.category}</p>
                {/* § A11Y-02: ปุ่มแสดงตลอด — เดิมซ่อนด้วย opacity-0 จน hover/focus ผู้ใช้คีย์บอร์ดและจอสัมผัสที่ไม่รองรับ pointer-coarse ต้องเดา */}
                <div className="mt-2 flex gap-1">
                  <button onClick={() => void openFile(item)} className="min-h-touch min-w-touch flex items-center justify-center rounded hover:bg-accent/10" aria-label={`เปิด ${item.filename}`}>
                    <ExternalLink className="h-3.5 w-3.5 text-muted" />
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
      {dialog}
    </>
  );
}
