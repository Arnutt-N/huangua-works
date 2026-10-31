'use client';

import { useState } from 'react';
import { AlertCircle, Camera, ExternalLink, FileImage } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

export interface CaseAttachmentItem {
  key: string;
  url: string | null;
  type: string;
  size: number;
  name?: string;
}

export interface CaseAttachmentsProps {
  attachments: CaseAttachmentItem[];
  storageConfigured: boolean;
}

/**
 * § Helper แปลงขนาดไฟล์จาก bytes เป็นหน่วย KB หรือ MB ที่อ่านง่าย
 */
function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * § CaseAttachments — คอมโพเนนต์แสดงผลรูปถ่ายหลักฐานที่ประชาชนแนบมากับเรื่องร้องเรียน
 * รองรับ Thumbnail grid, Radix Dialog สำหรับขยายภาพความละเอียดสูง, และ Fallback เมื่อ Object Storage ไม่พร้อมใช้งาน
 */
export function CaseAttachments({ attachments, storageConfigured }: CaseAttachmentsProps) {
  const [selectedAttachment, setSelectedAttachment] = useState<CaseAttachmentItem | null>(null);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  // § กรณี Object Storage ยังไม่ได้เปิดใช้งานในระบบ ให้แสดงข้อความแจ้งเตือนสุภาพโดยไม่ทำให้หน้าเว็บค้าง
  if (!storageConfigured) {
    return (
      <div className="rounded-xl border border-warning-soft bg-warning-soft/20 p-4 text-sm text-ink">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning-ink" aria-hidden="true" />
          <div>
            <p className="font-semibold text-warning-ink">ไม่สามารถแสดงภาพถ่ายหลักฐานได้</p>
            <p className="mt-1 text-muted">
              มีไฟล์แนบ {attachments.length} รายการ แต่ระบบจัดเก็บไฟล์ (Object Storage) ยังไม่ได้เปิดใช้งาน กรุณาตั้งค่า S3 ในระบบ
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-muted">
        <Camera className="h-4 w-4 text-accent" aria-hidden="true" />
        <span>ภาพถ่ายหรือเอกสารประกอบ ({attachments.length} รูป)</span>
      </h2>

      {/* § Thumbnail Grid — ตรึง aspect-video เพื่อป้องกัน Layout Shift (CLS) ขณะกำลังดาวน์โหลดรูปภาพ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {attachments.map((att) => {
          if (!att.url) {
            return (
              <div
                key={att.key}
                className="flex aspect-video w-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-sunken p-2 text-center text-xs text-muted"
              >
                <FileImage className="mb-1 h-6 w-6 text-muted" aria-hidden="true" />
                <span className="max-w-full truncate font-medium">{att.name || 'ไฟล์แนบ'}</span>
                <span className="text-[11px] text-danger-ink">ไม่สามารถโหลดภาพได้</span>
              </div>
            );
          }

          return (
            <button
              key={att.key}
              type="button"
              onClick={() => setSelectedAttachment(att)}
              aria-label={`ดูภาพขนาดใหญ่ ${att.name || 'ภาพหลักฐาน'}`}
              className="group relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-surface-sunken transition hover:border-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- รูปจาก storage ภายนอก ไม่ผ่าน Next image optimizer */}
              <img
                src={att.url}
                alt={att.name || 'ภาพหลักฐาน'}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition duration-150 group-hover:scale-105"
              />
              <span className="absolute bottom-1.5 right-1.5 rounded-md bg-ink/75 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-[2px]">
                {formatFileSize(att.size)}
              </span>
            </button>
          );
        })}
      </div>

      {/* § Modal ขยายดูภาพขนาดใหญ่พร้อมปุ่มเปิดรูปในแท็บใหม่ */}
      <Dialog open={!!selectedAttachment} onOpenChange={(open) => !open && setSelectedAttachment(null)}>
        <DialogContent className="max-w-3xl p-6">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-ink">
            <Camera className="h-4 w-4 text-accent" aria-hidden="true" />
            <span className="truncate">{selectedAttachment?.name || 'รูปภาพหลักฐาน'}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            ภาพถ่ายหลักฐานประกอบเรื่องร้องเรียน
          </DialogDescription>

          {selectedAttachment?.url && (
            <div className="mt-4 flex flex-col items-center gap-4">
              <div className="flex max-h-[70vh] w-full items-center justify-center overflow-hidden rounded-lg bg-surface-sunken">
                {/* eslint-disable-next-line @next/next/no-img-element -- รูปจาก storage ภายนอก ไม่ผ่าน Next image optimizer */}
                <img
                  src={selectedAttachment.url}
                  alt={selectedAttachment.name || 'รูปภาพหลักฐาน'}
                  className="max-h-[70vh] w-auto max-w-full object-contain"
                />
              </div>

              <div className="flex w-full flex-wrap items-center justify-between gap-3 pt-2">
                <span className="text-sm text-muted">
                  ขนาดไฟล์: {formatFileSize(selectedAttachment.size)}
                </span>
                <a
                  href={selectedAttachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-touch items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-on-accent transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  <span>เปิดภาพขนาดเต็มในแท็บใหม่</span>
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
