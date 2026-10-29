'use client';

import { AlertCircle, Bot, CheckCheck, RefreshCw, User, UserCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatTime } from '../_lib/format';
import type { Message } from '../_lib/types';
import { useMediaReadUrl } from '../_lib/use-media-read-url';
import { LineAvatar } from './line-avatar';

const SENDER_LABELS: Record<string, string> = {
  admin: 'เจ้าหน้าที่',
  bot: 'บอท',
};

/** เหตุผล ingest ล้มเป็นภาษาแอดมิน — ให้รู้ว่าต้องขอส่งใหม่หรือระบบล้ม */
function mediaSkippedLabel(reason: string): string {
  switch (reason) {
    case 'too_large':
      return 'ไฟล์ใหญ่เกิน 10 MB';
    case 'unsupported':
      return 'ชนิดไฟล์ไม่รองรับ';
    case 'upload_failed':
      return 'ฝากไฟล์ไม่สำเร็จ';
    case 'storage_unconfigured':
      return 'ระบบฝากไฟล์ยังไม่พร้อม';
    default:
      return 'ดาวน์โหลดไม่สำเร็จ';
  }
}

export function MessageBubble({
  message: msg,
  customerName,
  customerPicture,
  showSender = true,
  showAvatar = true,
  onRetry,
}: {
  message: Message;
  customerName: string | null;
  customerPicture: string | null;
  /** ข้อความแรกของชุด — โชว์ชื่อผู้ส่ง */
  showSender?: boolean;
  /** ข้อความสุดท้ายของชุด — โชว์ avatar (ตาม jsk avatar อยู่ล่างสุดของชุด) */
  showAvatar?: boolean;
  onRetry: (msg: Message) => void;
}) {
  const isAdmin = msg.sender === 'admin';
  const isBot = msg.sender === 'bot';
  // § ขอ presigned URL เมื่อ bubble มีไฟล์เท่านั้น — endpoint รับ messageId + conversationId
  // ไม่รับ key (route ฝั่ง server resolve key จากแถวเอง)
  const hasAttachment =
    msg.hasMedia === true &&
    (msg.messageType === 'image' ||
      msg.messageType === 'file' ||
      msg.messageType === 'video' ||
      msg.messageType === 'audio');
  const readEndpoint = hasAttachment
    ? `/api/line/admin/conversations/${msg.conversationId}/messages/${msg.id}/read-url`
    : null;
  const readUrl = useMediaReadUrl(readEndpoint);
  // ฝั่งขวา = ข้อความที่ออกจากเรา (เจ้าหน้าที่ + บอทตอบแทนเรา), ฝั่งซ้าย = ลูกค้า
  const outgoing = isAdmin || isBot;
  const senderLabel = SENDER_LABELS[msg.sender] ?? customerName ?? 'ผู้ใช้ LINE';

  const avatar = !showAvatar ? (
    <span className="h-7 w-7 flex-none" aria-hidden="true" />
  ) : outgoing ? (
    <span
      className={cn(
        'inline-flex h-7 w-7 flex-none items-center justify-center rounded-pill',
        isAdmin ? 'bg-success-soft text-success-ink' : 'bg-accent-sunken text-accent-strong',
      )}
      aria-hidden="true"
    >
      {isAdmin ? <UserCheck className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
    </span>
  ) : (
    <LineAvatar
      src={customerPicture}
      className="h-7 w-7 flex-none rounded-pill object-cover"
      fallback={
        <span
          className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-pill bg-surface-sunken text-muted"
          aria-hidden="true"
        >
          <User className="h-3.5 w-3.5" />
        </span>
      }
    />
  );

  return (
    <div
      className={cn(
        'flex items-end gap-2',
        outgoing ? 'justify-end' : 'justify-start',
        msg.status === 'pending' && 'opacity-60',
      )}
    >
      {!outgoing && avatar}
      <div
        className={cn(
          'flex max-w-[65%] flex-col gap-0.5',
          outgoing ? 'items-end' : 'items-start',
        )}
      >
        {showSender && (
          <span
            className={cn(
              'px-1 text-[10px] font-medium',
              isAdmin ? 'text-success-ink' : isBot ? 'text-accent-strong' : 'text-muted',
            )}
          >
            {senderLabel}
          </span>
        )}
        <div
          className={cn(
            'relative whitespace-pre-wrap break-words rounded-lg px-4 py-2.5 text-sm leading-relaxed shadow-sm',
            isAdmin
              ? 'bg-accent-gradient text-on-accent'
              : isBot
                ? 'border border-accent-strong/20 bg-accent-sunken text-ink'
                : 'border border-border bg-surface-raised text-ink',
          )}
        >
          {msg.messageType === 'image' && readUrl.status === 'ready' ? (
            <a href={readUrl.url} target="_blank" rel="noreferrer" aria-label="เปิดรูปต้นฉบับที่ผู้ใช้ส่ง">
              {/* eslint-disable-next-line @next/next/no-img-element -- รูปจาก storage ภายนอก ไม่ผ่าน Next image optimizer */}
              <img src={readUrl.url} alt="รูปที่ผู้ใช้ส่ง" className="max-h-64 w-auto rounded-md" />
            </a>
          ) : hasAttachment && readUrl.status === 'loading' ? (
            <span className="text-muted">กำลังโหลดไฟล์...</span>
          ) : hasAttachment && readUrl.status === 'failed' ? (
            <span className="text-muted">เปิดไฟล์ไม่ได้ — ลองรีเฟรชหน้าอีกครั้ง</span>
          ) : (msg.messageType === 'file' || msg.messageType === 'video' || msg.messageType === 'audio') &&
            readUrl.status === 'ready' ? (
            <a href={readUrl.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              {msg.metadata?.fileName ?? (msg.messageType === 'file' ? 'ไฟล์แนบ' : msg.messageType === 'video' ? 'วิดีโอแนบ' : 'เสียงแนบ')} (เปิดดู)
            </a>
          ) : (msg.messageType === 'image' || msg.messageType === 'file' || msg.messageType === 'video' || msg.messageType === 'audio') && msg.metadata?.skipped ? (
            <span className="text-muted">รับไฟล์ไม่สำเร็จ ({mediaSkippedLabel(msg.metadata.skipped)}) — ขอให้ผู้ใช้ส่งใหม่อีกครั้ง</span>
          ) : (
            (msg.textContent ?? `[${msg.messageType}]`)
          )}
        </div>
        <span className="flex items-center gap-1 px-1 text-[10px] text-muted">
          {msg.status === 'pending' ? (
            <>
              <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
              กำลังส่ง...
            </>
          ) : msg.status === 'failed' ? (
            <button
              type="button"
              onClick={() => onRetry(msg)}
              className="inline-flex items-center gap-1 font-semibold text-danger underline underline-offset-2"
            >
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              ส่งไม่สำเร็จ — ลองอีกครั้ง
            </button>
          ) : (
            <>
              <span className="tabular-nums">{formatTime(msg.createdAt)}</span>
              {isAdmin && <CheckCheck className="h-3 w-3 text-accent-strong" aria-hidden="true" />}
            </>
          )}
        </span>
      </div>
      {outgoing && avatar}
    </div>
  );
}
