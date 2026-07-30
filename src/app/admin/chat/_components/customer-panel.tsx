'use client';

import Link from 'next/link';
import { ExternalLink, UserRound, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatRelativeTime, maskLineUserId } from '../_lib/format';
import { FALLBACK_BADGE, MODE_BADGE, MODE_LABELS } from '../_lib/labels';
import type { Conversation, ConversationDetail, StaffMember } from '../_lib/types';
import { useNoteAutosave } from '../_hooks/use-note-autosave';
import { TagPicker } from './tag-picker';

const SAVE_LABEL: Record<string, string> = {
  dirty: 'กำลังพิมพ์...',
  saving: 'กำลังบันทึก...',
  saved: 'บันทึกแล้ว ✓',
  error: 'บันทึกไม่สำเร็จ',
};

export function CustomerPanel({
  conversation,
  detail,
  staff,
  onTagsSaved,
  onClose,
}: {
  conversation: Conversation | null;
  detail: ConversationDetail | null;
  staff: StaffMember[];
  onTagsSaved: () => void;
  /** ปุ่มปิด — desktop = พับ panel, mobile = ปิด dialog */
  onClose?: () => void;
}) {
  const { note, onChange, saveState } = useNoteAutosave(
    detail?.id ?? null,
    detail?.adminNote ?? null,
  );

  if (!conversation || !detail) return null;

  const name = conversation.displayName ?? 'ผู้ใช้ LINE';
  const noteUpdatedByName = detail.adminNoteUpdatedBy
    ? (staff.find((s) => s.id === detail.adminNoteUpdatedBy)?.fullName ?? null)
    : null;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex h-20 flex-none items-center justify-between gap-2 border-b border-border px-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink">ข้อมูลลูกค้า</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดแผงข้อมูลลูกค้า"
            className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted hover:bg-accent-sunken hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* โปรไฟล์ */}
      <div className="flex flex-none flex-col items-center gap-2 border-b border-border p-5 text-center">
        {conversation.pictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- รูปโปรไฟล์ LINE เป็น external URL ไม่ fix โดเมน
          <img
            src={conversation.pictureUrl}
            alt=""
            className="h-20 w-20 rounded-pill object-cover shadow-md ring-4 ring-surface-raised"
          />
        ) : (
          <span className="inline-flex h-20 w-20 items-center justify-center rounded-pill bg-accent-gradient-br text-on-accent shadow-md ring-4 ring-surface-raised">
            <UserRound className="h-10 w-10" aria-hidden="true" />
          </span>
        )}
        <div>
          <p className="text-sm font-bold text-ink">{name}</p>
          <p className="text-[11px] text-muted" title="LINE user id (ปิดบังบางส่วน)">
            {maskLineUserId(conversation.lineUserId)}
          </p>
        </div>
        <span
          className={cn(
            'rounded-pill px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
            MODE_BADGE[detail.mode] ?? FALLBACK_BADGE,
          )}
        >
          {MODE_LABELS[detail.mode] ?? detail.mode}
        </span>
      </div>

      <div className="space-y-5 p-4">
        {/* เคสที่ผูก */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">เคสที่ผูกไว้</h3>
          {detail.linkedCaseId ? (
            <Link
              href={`/admin/cases/${detail.linkedCaseId}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent-sunken px-2.5 py-1.5 text-xs font-semibold text-accent-strong hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              เปิดเคสที่เชื่อมโยง
            </Link>
          ) : (
            <p className="text-xs text-muted">ยังไม่ได้ผูกเคส</p>
          )}
        </div>

        {/* กิจกรรมล่าสุด */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">กิจกรรมล่าสุด</h3>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">ข้อความล่าสุด</dt>
              <dd className="font-medium text-ink">
                {conversation.lastMessageAt
                  ? formatRelativeTime(conversation.lastMessageAt)
                  : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">เริ่มสนทนา</dt>
              <dd className="font-medium text-ink">{formatRelativeTime(detail.createdAt)}</dd>
            </div>
          </dl>
        </div>

        <TagPicker
          conversationId={detail.id}
          selectedTags={conversation.tags ?? []}
          onSaved={onTagsSaved}
        />

        {/* โน้ตภายใน */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted">
              โน้ตภายใน
            </h3>
            <span
              className={cn(
                'text-[11px] font-medium',
                saveState === 'error' ? 'text-danger' : 'text-muted',
              )}
              aria-live="polite"
            >
              {SAVE_LABEL[saveState] ?? ''}
            </span>
          </div>
          <textarea
            value={note}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            placeholder="บันทึกช่วยจำสำหรับเจ้าหน้าที่ (ลูกค้าไม่เห็น)"
            aria-label="โน้ตภายในเกี่ยวกับลูกค้า"
            className={cn(
              'w-full resize-y rounded-md border border-border bg-surface-raised px-3 py-2 text-xs text-ink placeholder:text-muted',
              'transition-colors duration-normal ease-out-expo',
              'focus:border-accent-strong focus:outline-none focus-visible:ring focus-visible:ring-accent-strong/35',
            )}
          />
          {detail.adminNoteUpdatedAt && (
            <p className="text-[10px] text-muted">
              แก้ไขล่าสุด {formatRelativeTime(detail.adminNoteUpdatedAt)}
              {noteUpdatedByName ? ` โดย ${noteUpdatedByName}` : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
