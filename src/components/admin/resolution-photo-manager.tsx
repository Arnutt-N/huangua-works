'use client';

import { useState, useTransition, useRef, type ChangeEvent, type FormEvent } from 'react';
import { Camera, CheckCircle2, AlertCircle, Trash2, Loader2, ZoomIn, FileImage } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  uploadResolutionPhotoAction,
  deleteResolutionPhotoAction,
} from '@/app/admin/actions/cases';
import type { ResolutionPhoto, ResolutionPhotoTag } from '@/lib/cases/resolution-photos';
import { MEDIA_MAX_SIZE_BYTES, MEDIA_SIZE_ERROR } from '@/lib/media-upload-rules';
import { formatThaiDateTimeShort } from '@/lib/thai-date';
import { cn } from '@/lib/cn';

interface ResolutionPhotoManagerProps {
  caseId: string;
  photos: ResolutionPhoto[];
  storageConfigured: boolean;
}

export function ResolutionPhotoManager({
  caseId,
  photos,
  storageConfigured,
}: ResolutionPhotoManagerProps) {
  const [tag, setTag] = useState<ResolutionPhotoTag>('before');
  const [caption, setCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<ResolutionPhoto | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<ResolutionPhoto | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setErrorMessage(null);
    setSuccessMessage(null);
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    if (file.size > MEDIA_MAX_SIZE_BYTES) {
      setErrorMessage(MEDIA_SIZE_ERROR);
      e.target.value = '';
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  }

  function handleTagChange(newTag: ResolutionPhotoTag) {
    setTag(newTag);
  }

  function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('กรุณาเลือกไฟล์ภาพถ่าย');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const formData = new FormData();
    formData.append('caseId', caseId);
    formData.append('tag', tag);
    if (caption.trim()) {
      formData.append('caption', caption.trim());
    }
    formData.append('file', selectedFile);

    startTransition(async () => {
      const res = await uploadResolutionPhotoAction({ error: null }, formData);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage(res.success || 'บันทึกภาพถ่ายเรียบร้อย');
        setSelectedFile(null);
        setPreviewUrl(null);
        setCaption('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    });
  }

  function confirmDeletePhoto() {
    if (!photoToDelete) return;
    const target = photoToDelete;
    setPhotoToDelete(null);
    setErrorMessage(null);
    setSuccessMessage(null);

    const formData = new FormData();
    formData.append('caseId', caseId);
    formData.append('photoId', target.id);

    startTransition(async () => {
      const res = await deleteResolutionPhotoAction({ error: null }, formData);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage(res.success || 'ลบภาพถ่ายเรียบร้อย');
      }
    });
  }

  const beforePhotos = photos.filter((p) => p.tag === 'before');
  const afterPhotos = photos.filter((p) => p.tag === 'after');

  return (
    <div className="space-y-6">
      {/* ── ฟอร์มอัปโหลดภาพถ่าย ── */}
      <div className="rounded-xl border border-border bg-surface-raised p-4 sm:p-5 shadow-xs">
        <div className="mb-4 flex items-center gap-2">
          <Camera className="h-5 w-5 text-accent-strong" aria-hidden="true" />
          <h3 className="text-base font-bold text-ink">แนบภาพถ่ายผลการดำเนินงาน (ก่อนทำ / หลังทำ)</h3>
        </div>

        {!storageConfigured && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-warning-soft bg-warning-soft/20 p-3 text-xs text-warning-ink">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
            <p>ระบบจัดเก็บไฟล์ยังไม่ได้ตั้งค่า (Object Storage) การอัปโหลดภาพจะไม่สามารถใช้งานได้</p>
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-4">
          {/* เลือกแท็ก: ก่อนทำ / หลังทำ */}
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-muted">ประเภทภาพถ่าย</legend>
            <div role="radiogroup" aria-label="ประเภทภาพถ่ายผลงาน" className="flex flex-wrap gap-2">
              <button
                type="button"
                role="radio"
                aria-checked={tag === 'before'}
                onClick={() => handleTagChange('before')}
                className={cn(
                  'flex min-h-touch items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong',
                  tag === 'before'
                    ? 'border-accent-strong bg-accent-sunken text-accent-strong'
                    : 'border-border bg-surface text-muted hover:bg-surface-sunken hover:text-ink',
                )}
              >
                <span>ภาพก่อนดำเนินการ (Before)</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={tag === 'after'}
                onClick={() => handleTagChange('after')}
                className={cn(
                  'flex min-h-touch items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong',
                  tag === 'after'
                    ? 'border-success-ink bg-success-soft text-success-ink'
                    : 'border-border bg-surface text-muted hover:bg-surface-sunken hover:text-ink',
                )}
              >
                <span>ภาพหลังดำเนินการ (After)</span>
              </button>
            </div>
          </fieldset>

          {/* ช่องเลือกไฟล์ */}
          <div>
            <Label htmlFor="resolution-file">ไฟล์ภาพถ่าย (PNG, JPEG, WebP ขนาดไม่เกิน 10MB)</Label>
            <input
              ref={fileInputRef}
              id="resolution-file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="ไฟล์ภาพถ่ายผลการดำเนินงาน"
              onChange={handleFileChange}
              disabled={isPending || !storageConfigured}
              aria-describedby="resolution-file-hint"
              className="mt-1 block w-full text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-surface-sunken file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:bg-accent-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:opacity-50"
            />
            <p id="resolution-file-hint" className="mt-1 text-xs text-muted">
              แนะนำให้ถ่ายภาพในมุมมองที่เห็นจุดแก้ไขปัญหาชัดเจน และหลีกเลี่ยงการถ่ายติดบุคคลภายนอกโดยตรง
            </p>
          </div>

          {/* พรีวิวภาพที่เลือก */}
          {previewUrl && (
            <div className="relative aspect-video max-w-xs overflow-hidden rounded-lg border border-border bg-surface-sunken">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="ภาพตัวอย่างก่อนอัปโหลด"
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-1.5 left-1.5 rounded bg-ink/75 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-[2px]">
                {tag === 'before' ? 'ก่อนทำ' : 'หลังทำ'}
              </span>
            </div>
          )}

          {/* ช่องกรอกคำอธิบายภาพ */}
          <div>
            <Label htmlFor="resolution-caption">คำอธิบายภาพ (ไม่จำเป็น)</Label>
            <Input
              id="resolution-caption"
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="เช่น สภาพถนนก่อนเทคอนกรีต / ซ่อมเปลี่ยนหลอดไฟกิ่งเรียบร้อย"
              disabled={isPending || !storageConfigured}
              className="mt-1"
            />
          </div>

          {errorMessage && (
            <div role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft p-3 text-xs font-semibold text-danger-ink">
              <AlertCircle className="h-4 w-4 flex-none" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div role="status" className="flex items-center gap-2 rounded-lg bg-success-soft p-3 text-xs font-semibold text-success-ink">
              <CheckCircle2 className="h-4 w-4 flex-none" aria-hidden="true" />
              <span>{successMessage}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={isPending || !selectedFile || !storageConfigured}
            aria-busy={isPending}
            className="min-h-touch"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                กำลังอัปโหลด...
              </>
            ) : (
              'อัปโหลดภาพผลงาน'
            )}
          </Button>
        </form>
      </div>

      {/* ── แกลเลอรีภาพถ่ายผลการดำเนินงาน ── */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-muted">
          ภาพผลการดำเนินงานที่บันทึกแล้ว ({photos.length} ภาพ)
        </h4>

        {photos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface-sunken/40 p-6 text-center text-xs text-muted">
            ยังไม่มีภาพถ่ายผลการดำเนินงาน (สามารถอัปโหลดภาพก่อนทำและหลังทำได้ที่กล่องด้านบน)
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* กล่องกลุ่มภาพก่อนทำ */}
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="inline-flex items-center rounded-md bg-accent-sunken px-2.5 py-1 text-xs font-bold text-accent-strong">
                  ก่อนดำเนินการ (Before) · {beforePhotos.length}
                </span>
              </div>
              {beforePhotos.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted">ไม่มีภาพก่อนทำ</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {beforePhotos.map((photo) => (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      onView={() => setViewingPhoto(photo)}
                      onDelete={() => setPhotoToDelete(photo)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* กล่องกลุ่มภาพหลังทำ */}
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="inline-flex items-center rounded-md bg-success-soft px-2.5 py-1 text-xs font-bold text-success-ink">
                  หลังดำเนินการ (After) · {afterPhotos.length}
                </span>
              </div>
              {afterPhotos.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted">ไม่มีภาพหลังทำ</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {afterPhotos.map((photo) => (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      onView={() => setViewingPhoto(photo)}
                      onDelete={() => setPhotoToDelete(photo)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Dialog ขยายภาพความละเอียดสูง (Lightbox) ── */}
      <Dialog open={!!viewingPhoto} onOpenChange={(open) => !open && setViewingPhoto(null)}>
        <DialogContent className="max-w-3xl overflow-hidden p-0">
          <DialogTitle className="sr-only">ภาพถ่ายผลการดำเนินงาน</DialogTitle>
          <DialogDescription className="sr-only">
            {viewingPhoto?.caption || 'ภาพถ่ายผลการดำเนินงานของเจ้าหน้าที่'}
          </DialogDescription>
          {viewingPhoto && (
            <div>
              <div className="relative aspect-video w-full bg-black/90">
                {viewingPhoto.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={viewingPhoto.url}
                    alt={viewingPhoto.caption || 'ภาพถ่ายผลการดำเนินงาน'}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white">
                    <FileImage className="mr-2 h-6 w-6" aria-hidden="true" />
                    ไม่สามารถโหลดภาพได้
                  </div>
                )}
              </div>
              <div className="p-4 bg-surface">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5 text-xs font-bold',
                      viewingPhoto.tag === 'before'
                        ? 'bg-accent-sunken text-accent-strong'
                        : 'bg-success-soft text-success-ink',
                    )}
                  >
                    {viewingPhoto.tag === 'before' ? 'ก่อนดำเนินการ (Before)' : 'หลังดำเนินการ (After)'}
                  </span>
                  <span className="text-xs text-muted">
                    {formatThaiDateTimeShort(new Date(viewingPhoto.uploadedAt))}
                  </span>
                </div>
                {viewingPhoto.caption && (
                  <p className="mt-2 text-sm text-ink">{viewingPhoto.caption}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog ยืนยันการลบภาพถ่าย (Destructive Guard) ── */}
      <Dialog open={!!photoToDelete} onOpenChange={(open) => !open && setPhotoToDelete(null)}>
        <DialogContent className="max-w-md p-6">
          <DialogTitle className="text-base font-bold text-ink">ยืนยันการลบภาพถ่ายผลงาน</DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted">
            ท่านต้องการลบภาพถ่ายนี้ ({photoToDelete?.tag === 'before' ? 'ภาพก่อนทำ' : 'ภาพหลังทำ'}) ออกจากเรื่องร้องเรียนและระบบจัดเก็บข้อมูลอย่างถาวรหรือไม่? การกระทำนี้ไม่สามารถย้อนคืนได้
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPhotoToDelete(null)}
              className="min-h-touch"
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={confirmDeletePhoto}
              className="min-h-touch bg-danger-soft font-semibold text-danger-ink hover:bg-danger-soft/80"
            >
              ยืนยันการลบ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PhotoCard({
  photo,
  onView,
  onDelete,
}: {
  photo: ResolutionPhoto;
  onView: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-surface-sunken">
      {photo.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.url}
          alt={photo.caption || 'ภาพผลงาน'}
          loading="lazy"
          className="h-full w-full object-cover transition duration-150 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center text-xs text-muted">
          <FileImage className="mb-1 h-5 w-5 text-muted" aria-hidden="true" />
          <span>ไม่สามารถแสดงภาพได้</span>
        </div>
      )}

      {/* Action Overlay: ปุ่มดูภาพ และ ปุ่มลบภาพ */}
      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={onView}
          aria-label={`ดูภาพขยาย ${photo.caption || ''}`}
          className="flex min-h-touch min-w-touch items-center justify-center rounded-lg bg-surface/90 text-ink shadow-sm hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
        >
          <ZoomIn className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`ลบภาพถ่าย ${photo.caption || photo.tag}`}
          className="flex min-h-touch min-w-touch items-center justify-center rounded-lg bg-danger-soft text-danger-ink shadow-sm hover:bg-danger-soft/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger-ink"
        >
          <Trash2 className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {photo.caption && (
        <div className="absolute bottom-0 inset-x-0 bg-ink/75 p-1 px-1.5 backdrop-blur-[2px]">
          <p className="truncate text-[11px] font-medium text-white">{photo.caption}</p>
        </div>
      )}
    </div>
  );
}
