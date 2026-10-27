'use client';

import { useState } from 'react';
import Link from 'next/link';
import { adminApi, type BroadcastItem } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import {
  ArrowLeft,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  Users,
  Radio,
  Trash2,
} from 'lucide-react';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { Button } from '@/components/ui/button';
import { AdminErrorState } from '@/components/admin/admin-error-state';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STATUS: Record<string, { label: string; icon: typeof Clock; cls: string }> = {
  draft: { label: 'ร่าง', icon: Clock, cls: 'text-muted' },
  scheduled: { label: 'รอส่ง', icon: Clock, cls: 'text-warning' },
  sending: { label: 'กำลังส่ง', icon: Loader2, cls: 'text-accent-strong' },
  sent: { label: 'ส่งแล้ว', icon: CheckCircle2, cls: 'text-success' },
  failed: { label: 'ล้มเหลว', icon: XCircle, cls: 'text-danger' },
  cancelled: { label: 'ยกเลิก', icon: XCircle, cls: 'text-muted' },
};

function contentText(item: BroadcastItem): string {
  if (item.title) return item.title;
  const first = item.content[0];
  if (!first) return '—';
  if (first.type === 'text' && first.text) return first.text;
  return `[${first.type}]`;
}

const THAI_DATETIME: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

function formatThai(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', THAI_DATETIME);
}

function ContentPreview({ item }: { item: BroadcastItem }) {
  if (item.content.length === 0) return <p className="text-sm text-muted">—</p>;
  return (
    <div className="space-y-3">
      {item.content.map((c, i) => {
        if (c.type === 'text') {
          return (
            <p key={i} className="whitespace-pre-wrap text-sm text-ink">
              {c.text}
            </p>
          );
        }
        if (c.type === 'image') {
          const url = String(c.originalContentUrl ?? '');
          const preview = String(c.previewImageUrl ?? url);
          return (
            <div key={i} className="space-y-1">
              <p className="break-all font-mono text-xs text-muted">{url}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="ตัวอย่างรูปประกาศ"
                className="max-w-xs rounded-lg border border-border"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          );
        }
        return (
          <div key={i} className="space-y-1">
            <p className="text-xs text-muted">altText: {String(c.altText ?? '')}</p>
            <pre className="max-h-64 overflow-auto rounded-md bg-surface-sunken p-2 font-mono text-xs text-ink">
              {JSON.stringify(c.contents ?? {}, null, 2)}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

function TimelineItem({ done, label, date }: { done: boolean; label: string; date: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${done ? 'bg-accent-strong' : 'bg-border'}`} />
      <span>
        <span className={`block text-sm font-medium ${done ? 'text-ink' : 'text-muted'}`}>{label}</span>
        {date && (
          <span className="block text-xs text-muted">
            {new Date(date).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </span>
    </div>
  );
}

export function BroadcastDetailClient({ broadcastId }: { broadcastId: string }) {
  const [sending, setSending] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { data, loading, feedback, error, errorCode, errorStatus, mutate, notify, reload } = useResource({
    load: (_q, opts) => adminApi.getBroadcast(broadcastId, opts),
  });
  const item = data ?? null;

  async function handleSend() {
    if (!item) return;
    if (!confirm('ส่งประกาศนี้ทันที?')) return;
    setSending(true);
    await mutate(() => adminApi.sendBroadcast(item.id), 'ส่งประกาศสำเร็จ');
    setSending(false);
  }

  async function handleCancel() {
    if (!item) return;
    setCancelling(true);
    const res = await adminApi.cancelBroadcast(item.id);
    setCancelling(false);
    setCancelOpen(false);
    if (!res.ok) {
      notify('error', res.error);
      return;
    }
    notify('success', 'ยกเลิกประกาศแล้ว');
    await reload();
  }

  if (loading) return <div className="py-12 text-center text-muted">กำลังโหลด...</div>;
  if (!item && error && errorStatus !== 404) return <AdminErrorState error={error} errorCode={errorCode} onRetry={() => void reload()} />;
  if (!item) return <div className="py-12 text-center text-muted">ไม่พบข้อมูล broadcast</div>;

  const st = STATUS[item.status] ?? STATUS.draft!;
  const Icon = st.icon;
  const rate = item.totalRecipients > 0 ? (item.successCount / item.totalRecipients) * 100 : 0;

  return (
    <div className="space-y-4">
      {feedback && (
        <div role="status" className={`rounded-lg px-4 py-3 text-sm font-medium ${feedback.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
          {feedback.msg}
        </div>
      )}
      <Link href="/admin/chatbot/broadcast" className="inline-flex min-h-touch items-center gap-1.5 text-sm font-semibold text-accent-strong">
        <ArrowLeft className="h-4 w-4" /> กลับไปรายการ
      </Link>

      <AdminCard>
        <AdminCardTitle icon={<Icon className={`h-4 w-4 ${st.cls}`} />}>
          {contentText(item)}
        </AdminCardTitle>
        <div className="grid gap-4 sm:grid-cols-2 text-sm">
          <p><span className="text-muted">สถานะ: </span><span className={`font-semibold ${st.cls}`}>{st.label}</span></p>
          <p><span className="text-muted">กลุ่มเป้าหมาย: </span>
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-muted" />
              {item.target?.kind === 'line_user_ids' ? `เฉพาะกลุ่ม ${item.target.ids.length} คน` : 'ผู้ติดตามทั้งหมด'}
            </span>
          </p>
          <p><span className="text-muted">สร้าง: </span>
            <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-muted" />
              {formatThai(item.createdAt)}
            </span>
          </p>
          {item.sentAt && (
            <p><span className="text-muted">วันที่ส่ง: </span>
              <span className="font-medium text-success">
                {formatThai(item.sentAt)}
              </span>
            </p>
          )}
          {item.scheduledAt && item.status === 'scheduled' && (
            <p><span className="text-muted">กำหนดส่ง: </span>
              <span className="font-medium text-warning">
                {formatThai(item.scheduledAt)}
              </span>
            </p>
          )}
        </div>
      </AdminCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminCard>
          <AdminCardTitle icon={<Send className="h-4 w-4" />}>สถิติการส่ง</AdminCardTitle>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">ผู้รับทั้งหมด</dt><dd className="font-bold text-ink">{item.totalRecipients}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">สำเร็จ</dt><dd className="font-bold text-success">{item.successCount}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">ล้มเหลว</dt><dd className="font-bold text-danger">{item.failedCount}</dd></div>
            {item.totalRecipients > 0 && (
              <div className="pt-2">
                <div className="flex justify-between text-xs text-muted"><span>อัตราสำเร็จ</span><span>{rate.toFixed(1)}%</span></div>
                <div className="mt-1 h-2 rounded-full bg-surface-sunken"><div className="h-2 rounded-full bg-success" style={{ width: `${rate}%` }} /></div>
              </div>
            )}
          </dl>
          {item.failedRecipients > 0 && (
            <p className="mt-2 text-xs text-muted">บันทึกผู้รับล้มเหลว {item.failedRecipients} ราย (hash อย่างเดียว ไม่เก็บ raw id)</p>
          )}
        </AdminCard>

        <AdminCard>
          <AdminCardTitle icon={<Clock className="h-4 w-4" />}>ไทม์ไลน์</AdminCardTitle>
          <div className="space-y-3">
            <TimelineItem done label="สร้างแบบร่าง" date={item.createdAt} />
            {item.scheduledAt && <TimelineItem done={item.status !== 'draft'} label="ตั้งเวลาส่ง" date={item.scheduledAt} />}
            {item.sentAt && <TimelineItem done label="ส่งสำเร็จ" date={item.sentAt} />}
            {item.status === 'failed' && <TimelineItem done label="ส่งล้มเหลว" date={item.updatedAt} />}
          </div>
        </AdminCard>

        <AdminCard>
          <AdminCardTitle icon={<Radio className="h-4 w-4" />}>การดำเนินการ</AdminCardTitle>
          <div className="space-y-2">
            {(item.status === 'draft' || item.status === 'scheduled') && (
              <>
                <Button onClick={handleSend} disabled={sending} className="w-full gap-2">
                  <Send className="h-4 w-4" /> {sending ? 'กำลังส่ง...' : 'ส่ง'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCancelOpen(true)}
                  disabled={cancelling}
                  className="w-full gap-2 text-danger"
                >
                  <Trash2 className="h-4 w-4" /> ยกเลิกประกาศ
                </Button>
              </>
            )}
            {item.status === 'cancelled' && (
              <p className="text-sm text-muted">
                ประกาศนี้ถูกยกเลิกแล้ว — แถวยังอยู่ในระบบเพื่อดูย้อนหลัง ไม่ถูกลบ
              </p>
            )}
            {item.status === 'sent' && (
              <p className="text-sm text-muted">ส่งแล้ว — ยกเลิกหรือแก้ไขไม่ได้</p>
            )}
          </div>
        </AdminCard>
      </div>

      <AdminCard>
        <AdminCardTitle icon={<Send className="h-4 w-4" />}>เนื้อหาที่ส่ง</AdminCardTitle>
        <ContentPreview item={item} />
      </AdminCard>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ยกเลิกประกาศ</DialogTitle>
          </DialogHeader>
          <p className="py-2 text-sm text-muted">
            ยกเลิก &quot;{contentText(item)}&quot;? ประกาศจะเปลี่ยนสถานะเป็น &quot;ยกเลิก&quot;
            และไม่ถูกส่ง — แถวยังคงอยู่เพื่อดูย้อนหลัง
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>กลับ</Button>
            <Button
              onClick={() => void handleCancel()}
              disabled={cancelling}
              className="bg-danger text-on-accent hover:bg-danger/90"
            >
              {cancelling ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
