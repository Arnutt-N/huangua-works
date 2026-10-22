'use client';

import { useState } from 'react';
import Link from 'next/link';
import { adminApi, type BroadcastItem } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import { ArrowLeft, Send, Clock, CheckCircle2, XCircle, Loader2, Calendar, Users, Radio } from 'lucide-react';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { Button } from '@/components/ui/button';

const STATUS: Record<string, { label: string; icon: typeof Clock; cls: string }> = {
  draft: { label: 'ร่าง', icon: Clock, cls: 'text-muted' },
  scheduled: { label: 'รอส่ง', icon: Clock, cls: 'text-warning' },
  sending: { label: 'กำลังส่ง', icon: Loader2, cls: 'text-accent-strong' },
  sent: { label: 'ส่งแล้ว', icon: CheckCircle2, cls: 'text-success' },
  failed: { label: 'ล้มเหลว', icon: XCircle, cls: 'text-danger' },
};

function contentText(item: BroadcastItem): string {
  const first = item.content[0];
  if (!first) return '—';
  if (first.type === 'text' && first.text) return first.text;
  return `[${first.type}]`;
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
  const { data, loading, feedback, mutate } = useResource({
    load: () => adminApi.getBroadcast(broadcastId),
  });
  const item = data ?? null;

  async function handleSend() {
    if (!item) return;
    if (!confirm('ส่งประกาศนี้ทันที?')) return;
    setSending(true);
    await mutate(() => adminApi.sendBroadcast(item.id), 'ส่งประกาศสำเร็จ');
    setSending(false);
  }

  if (loading) return <div className="py-12 text-center text-muted">กำลังโหลด...</div>;
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
              {new Date(item.createdAt).toLocaleString('th-TH', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </p>
          {item.sentAt && (
            <p><span className="text-muted">วันที่ส่ง: </span>
              <span className="font-medium text-success">
                {new Date(item.sentAt).toLocaleString('th-TH', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
          )}
          {item.scheduledAt && item.status === 'scheduled' && (
            <p><span className="text-muted">กำหนดส่ง: </span>
              <span className="font-medium text-warning">
                {new Date(item.scheduledAt).toLocaleString('th-TH', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
              <Button onClick={handleSend} disabled={sending} className="w-full gap-2">
                <Send className="h-4 w-4" /> {sending ? 'กำลังส่ง...' : 'ส่ง'}
              </Button>
            )}
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
