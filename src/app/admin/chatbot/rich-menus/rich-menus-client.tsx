'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, Eye, ImageUp, Link2, Plus, RefreshCw, SquarePen, Trash2, Users } from 'lucide-react';
import type { RichMenuItem } from '@/app/admin/_lib/admin-api';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/admin/page-header';
import { AdminErrorState } from '@/components/admin/admin-error-state';
import { DetailModal } from '@/components/admin/detail-modal';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { cn } from '@/lib/cn';
import { fitRichMenuImage, RICH_MENU_FIT_GUIDANCE } from './rich-menu-image';
import {
  menuStatusPill,
  needsResync,
  pillTone,
  primaryAction,
  toLocalDatetimeInputValue,
} from './rich-menu-state';

export function RichMenusClient() {
  const router = useRouter();
  const { data, loading, feedback, error, errorCode, notify, mutate, reload } = useResource({ load: adminApi.listRichMenus });
  const items = data?.items ?? [];

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [imageRev, setImageRev] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [viewMenu, setViewMenu] = useState<RichMenuItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RichMenuItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<RichMenuItem | null>(null);

  async function handleSync(item: RichMenuItem) {
    setSyncingId(item.id);
    await mutate(() => adminApi.syncRichMenu(item.id), 'ซิงค์ไป LINE สำเร็จ');
    setSyncingId(null);
  }

  function pickImage(item: RichMenuItem) {
    uploadTargetRef.current = item;
    fileRef.current?.click();
  }

  async function handleImagePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const item = uploadTargetRef.current;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!item || !file) return;
    setUploadingId(item.id);
    try {
      const fitted = await fitRichMenuImage(file);
      if (!fitted.fits) {
        notify('error', RICH_MENU_FIT_GUIDANCE);
        return;
      }
      const uploadFile =
        fitted.file instanceof File && !fitted.converted
          ? fitted.file
          : new File([fitted.file], fitted.filename, { type: 'image/jpeg' });
      const ok = await mutate(
        () => adminApi.uploadRichMenuImage(item.id, uploadFile),
        'อัปรูปเมนูสำเร็จ — กด Set Active เพื่อเปิดใช้งานได้เลย',
      );
      if (ok) {
        setFailedImages((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        setImageRev((r) => r + 1);
      }
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'รูปไม่พร้อมอัปโหลด');
    } finally {
      setUploadingId(null);
    }
  }

  async function handlePublish(item: RichMenuItem) {
    if (publishingId !== null) return;
    setPublishingId(item.id);
    try {
      await mutate(() => adminApi.publishRichMenu(item.id), 'ตั้งเป็นเมนูหลักสำเร็จ');
    } finally {
      setPublishingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const ok = await mutate(() => adminApi.deleteRichMenu(deleteTarget.id), 'ลบ Rich Menu แล้ว');
    setDeleting(false);
    if (ok) setDeleteTarget(null);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Rich Menus" subtitle="จัดการเมนู LINE Official Account">
        <Link href="/admin/chatbot/rich-menus/aliases">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <Link2 className="h-4 w-4" /> Aliases
          </Button>
        </Link>
        <Link href="/admin/chatbot/rich-menus/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> New Menu
          </Button>
        </Link>
      </PageHeader>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg"
        aria-label="เลือกไฟล์รูปเมนู"
        className="hidden"
        onChange={handleImagePicked}
      />

      {feedback && (
        <div
          role="status"
          className={cn(
            'rounded-lg px-4 py-3 text-sm font-medium',
            feedback.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
          )}
        >
          {feedback.msg}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-muted">กำลังโหลดข้อมูล...</div>
      ) : data === null && error ? (
        <AdminErrorState error={error} errorCode={errorCode} onRetry={() => void reload()} />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted">ไม่พบข้อมูลเมนูในระบบ</p>
          <Link href="/admin/chatbot/rich-menus/new" className="mt-2 block text-sm text-accent-strong hover:underline">
            สร้างเมนูแรกของคุณ →
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-border/50 text-xs font-semibold uppercase tracking-wide text-muted">
                  <th scope="col" className="w-40 px-4 py-3 text-center">Preview</th>
                  <th scope="col" className="px-4 py-3">รายละเอียดเมนู</th>
                  <th scope="col" className="px-4 py-3 text-center">สถานะ</th>
                  <th scope="col" className="px-4 py-3 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {items.map((item) => {
                  const pill = menuStatusPill(item);
                  const action = primaryAction(item);
                  const imageFailed = failedImages.has(item.id);
                  return (
                    <tr key={item.id} className="transition-colors hover:bg-accent/5">
                      <td className="px-4 py-4">
                        <div className="aspect-[250/168.6] w-32 overflow-hidden rounded-lg border border-border bg-surface-sunken">
                          {item.lineRichMenuId && !imageFailed ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`/api/line/admin/rich-menus/${item.id}/image?v=${imageRev}`}
                              alt={item.name}
                              className="h-full w-full object-cover"
                              onError={() =>
                                setFailedImages((prev) => new Set(prev).add(item.id))
                              }
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-surface-sunken px-2 text-center text-[10px] text-muted">
                              No Image
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-ink">{item.name}</p>
                        <p className="mt-1 text-xs text-muted">
                          <span className="font-medium">Bar Text:</span>{' '}
                          <span className="italic">&quot;{item.chatBarText}&quot;</span>
                        </p>
                        <p className="mt-1 truncate font-mono text-[10px] text-muted">
                          {item.lineRichMenuId ?? 'LOCAL_ONLY'}
                        </p>
                        {(item.userLinkCount ?? 0) > 0 && (
                          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-accent-sunken px-1.5 py-0.5 text-[10px] font-bold text-accent-strong">
                            <Users className="h-3 w-3" /> {item.userLinkCount} ผู้ใช้
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          title={pill.title}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[10px] font-bold',
                            pillTone[pill.tone],
                          )}
                        >
                          {pill.label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {action === 'sync' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs"
                              onClick={() => handleSync(item)}
                              disabled={syncingId === item.id}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              {syncingId === item.id ? 'กำลังซิงค์...' : 'Sync to LINE'}
                            </Button>
                          )}
                          {action === 'resync' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs"
                              onClick={() => handleSync(item)}
                              disabled={syncingId === item.id}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              {syncingId === item.id
                                ? 'กำลังซิงค์...'
                                : needsResync(item)
                                  ? 'ซิงค์การแก้ไข'
                                  : 'Re-sync'}
                            </Button>
                          )}
                          {item.lineRichMenuId && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs"
                              onClick={() => pickImage(item)}
                              disabled={uploadingId === item.id}
                              aria-label={`อัปรูป ${item.name}`}
                              title="อัปโหลดรูปภาพเมนูขึ้น LINE (PNG/JPEG ไม่เกิน 1 MB)"
                            >
                              <ImageUp className="h-3.5 w-3.5" />
                              {uploadingId === item.id ? 'กำลังอัป...' : 'อัปรูป'}
                            </Button>
                          )}
                          {action === 'publish' && (
                            <Button size="sm" className="text-xs" onClick={() => handlePublish(item)} disabled={publishingId !== null}>
                              {publishingId === item.id ? 'กำลังตั้งค่า...' : 'Set Active'}
                            </Button>
                          )}
                          {action === null && (
                            <span className="rounded-full border border-success/30 bg-success-soft px-3 py-1 text-[10px] font-black tracking-widest text-success-ink">
                              Live Now
                            </span>
                          )}

                          <div className="flex items-center gap-1 border-l border-border pl-3">
                            {item.lineRichMenuId && (
                              <Link
                                href={`/admin/chatbot/rich-menus/${item.id}/insights`}
                                aria-label={`สถิติ ${item.name}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-accent-sunken hover:text-accent-strong"
                              >
                                <BarChart3 className="h-4 w-4" />
                              </Link>
                            )}
                            <button
                              type="button"
                              aria-label={`ดูรายละเอียด ${item.name}`}
                              onClick={() => setViewMenu(item)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-accent-sunken hover:text-accent-strong"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <Link
                              href={`/admin/chatbot/rich-menus/${item.id}/edit`}
                              aria-label={`แก้ไข ${item.name}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-accent-sunken hover:text-accent-strong"
                            >
                              <SquarePen className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              aria-label={`ลบ ${item.name}`}
                              onClick={() => setDeleteTarget(item)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-danger hover:bg-danger/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DetailModal
        title="รายละเอียดริชเมนู"
        open={viewMenu !== null}
        onClose={() => setViewMenu(null)}
        rows={
          viewMenu
            ? [
                { label: 'ชื่อเมนู', value: viewMenu.name },
                { label: 'ข้อความแถบแชท', value: <span className="italic">&quot;{viewMenu.chatBarText}&quot;</span> },
                { label: 'LINE Rich Menu ID', value: <span className="font-mono text-xs">{viewMenu.lineRichMenuId ?? 'LOCAL_ONLY'}</span> },
                {
                  label: 'ช่วงเวลาแสดงผล',
                  value:
                    [viewMenu.displayStartAt, viewMenu.displayEndAt]
                      .map((v) => (v ? toLocalDatetimeInputValue(v).replace('T', ' ') : null))
                      .filter(Boolean)
                      .join(' – ') || 'ตลอดเวลา',
                },
                { label: 'ผู้ใช้ที่ผูกเมนูนี้', value: `${viewMenu.userLinkCount ?? 0} คน` },
              ]
            : []
        }
        renderExtra={
          viewMenu?.lineRichMenuId && !failedImages.has(viewMenu.id) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/line/admin/rich-menus/${viewMenu.id}/image`}
              alt={viewMenu.name}
              className="w-full rounded-lg border border-border"
              onError={() => setFailedImages((prev) => new Set(prev).add(viewMenu.id))}
            />
          ) : undefined
        }
        actions={
          viewMenu
            ? [
                {
                  label: 'แก้ไข',
                  variant: 'outline',
                  onClick: () => {
                    const id = viewMenu.id;
                    setViewMenu(null);
                    router.push(`/admin/chatbot/rich-menus/${id}/edit`);
                  },
                },
                { label: 'ปิด', onClick: () => setViewMenu(null) },
              ]
            : undefined
        }
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="ยืนยันการลบ"
        description={`ต้องการลบ Rich Menu "${deleteTarget?.name ?? ''}" หรือไม่?`}
        confirmText="ลบ"
        danger
        busy={deleting}
      />
    </div>
  );
}
