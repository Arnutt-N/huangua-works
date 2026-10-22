'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { BroadcastItem } from '@/app/admin/_lib/admin-api';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import { Plus, Send, Clock, CheckCircle2, XCircle, Loader2, Radio } from 'lucide-react';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FieldHint, Label, Textarea } from '@/components/ui/field';
/**
 * รอบการตรวจคิวส่งประกาศ (นาที) — ต้องตรงกับ schedule ที่ตั้งไว้ใน cron-job.org
 * ที่ยิง /api/cron/broadcast-send ใช้บอกผู้ใช้ว่าประกาศอาจออกช้ากว่าเวลาที่ตั้งได้แค่ไหน
 */
const SEND_WINDOW_MINUTES = 30;

const STATUS_MAP: Record<string, { label: string; icon: typeof Clock; cls: string }> = {
  draft: { label: 'ร่าง', icon: Clock, cls: 'text-muted' },
  scheduled: { label: 'รอส่ง', icon: Clock, cls: 'text-warning' },
  sending: { label: 'กำลังส่ง', icon: Loader2, cls: 'text-accent-strong' },
  sent: { label: 'ส่งแล้ว', icon: CheckCircle2, cls: 'text-success' },
  failed: { label: 'ล้มเหลว', icon: XCircle, cls: 'text-danger' },
};

const TYPE_LABELS: Record<string, string> = {
  text: 'ข้อความ',
  image: 'รูปภาพ',
  flex: 'Flex Message',
};

function broadcastName(item: BroadcastItem): string {
  const first = item.content[0];
  if (!first) return '—';
  if (first.type === 'text' && first.text) return first.text;
  return `[${first.type}]`;
}

function broadcastType(item: BroadcastItem): string {
  const first = item.content[0];
  if (!first) return '—';
  return TYPE_LABELS[first.type] ?? `[${first.type}]`;
}

export function BroadcastClient() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [targetKind, setTargetKind] = useState<'all' | 'specific'>('all');
  const [recipientOptions, setRecipientOptions] = useState<{ id: string; displayName: string | null }[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  // § API ยังไม่มี query status — ส่ง status เป็น query key ของ hook เพื่อ reload
  // เมื่อเปลี่ยนฟิลเตอร์ แล้วกรองฝั่ง client (กัน response เก่าค้างข้ามฟิลเตอร์)
  const { data, loading, feedback, notify, mutate } = useResource({
    load: adminApi.listBroadcasts,
    query: statusFilter,
  });
  const filtered = useMemo(
    () => (statusFilter ? (data?.items ?? []).filter((i) => i.status === statusFilter) : (data?.items ?? [])),
    [data, statusFilter],
  );

  async function openDialog() {
    setDialogOpen(true);
    const res = await adminApi.listBroadcastRecipients();
    if (res.ok) setRecipientOptions(res.data.items);
  }

  function currentTarget(): { kind: 'all' } | { kind: 'line_user_ids'; ids: string[] } {
    return targetKind === 'all' ? { kind: 'all' } : { kind: 'line_user_ids', ids: selectedIds };
  }

  async function refreshEstimate() {
    const res = await adminApi.dryRunBroadcast(currentTarget());
    setEstimate(res.ok ? res.data.estimatedRecipients : null);
  }

  async function handleCreate() {
    if (!message.trim()) {
      notify('error', 'กรุณากรอกข้อความ');
      return;
    }
    if (targetKind === 'specific' && selectedIds.length === 0) {
      notify('error', 'กรุณาเลือกผู้รับอย่างน้อย 1 คน');
      return;
    }
    setSaving(true);
    const ok = await mutate(
      () =>
        adminApi.createBroadcast({
          content: [{ type: 'text', text: message.trim() }],
          target: currentTarget(),
          scheduledAt: scheduleAt ? new Date(scheduleAt).toISOString() : null,
        }),
      scheduleAt ? 'ตั้งเวลาส่งแล้ว' : 'สร้างร่างสำเร็จ',
    );
    setSaving(false);
    if (ok) {
      setDialogOpen(false);
      setMessage('');
      setScheduleAt('');
      setSelectedIds([]);
      setTargetKind('all');
      setEstimate(null);
    }
  }

  async function handleSend(item: BroadcastItem) {
    const scope = item.target?.kind === 'line_user_ids'
      ? `ผู้รับที่เลือก ${item.target.ids.length} คน`
      : 'ผู้ติดตามทุกคน';
    if (!confirm(`ส่งประกาศหา${scope}ทันที?`)) return;
    // server คืน 409 { error: 'ส่งแล้วหรือกำลังส่ง' } / 404 / 502 เมื่อส่งไม่สำเร็จ — mutate โชว์ข้อความนั้น
    await mutate(() => adminApi.sendBroadcast(item.id), 'ส่งประกาศสำเร็จ');
  }

  return (
    <>
      {feedback && (
        <div role="status" className={`rounded-lg px-4 py-3 text-sm font-medium ${feedback.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
          {feedback.msg}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="กรองสถานะ"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-h-touch rounded-md border border-border bg-surface-raised px-4 text-ink"
        >
            <option value="">ทุกสถานะ</option>
            <option value="draft">ร่าง</option>
            <option value="scheduled">รอส่ง</option>
            <option value="sending">กำลังส่ง</option>
            <option value="sent">ส่งแล้ว</option>
            <option value="failed">ล้มเหลว</option>
          </select>
      </div>

      <AdminCard>
        <AdminCardTitle
          icon={<Send className="h-4 w-4" />}
          action={
            <span className="flex gap-2">
              <Link
                href="/admin/chatbot/broadcast/new"
                className="inline-flex min-h-touch items-center gap-1.5 rounded-md bg-accent-strong px-4 text-sm font-semibold text-on-accent"
              >
                <Plus className="h-4 w-4" /> สร้างข้อความ
              </Link>
              <Button onClick={openDialog} variant="outline" className="min-h-touch gap-1.5">
                <Plus className="h-4 w-4" /> ด่วน
              </Button>
            </span>
          }
        >
          ประวัติ Broadcast ({filtered.length})
        </AdminCardTitle>

        {loading ? (
          <div className="py-12 text-center text-muted">กำลังโหลด...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-border/50 text-xs font-semibold uppercase tracking-wide text-muted">
                  <th scope="col" className="px-4 py-3">ชื่อแคมเปญ</th>
                  <th scope="col" className="px-4 py-3">ประเภท</th>
                  <th scope="col" className="px-4 py-3">สถานะ</th>
                  <th scope="col" className="px-4 py-3">ผู้รับ</th>
                  <th scope="col" className="px-4 py-3">วันที่ส่ง</th>
                  <th scope="col" className="px-4 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted">
                        <Radio className="h-10 w-10 opacity-30" aria-hidden="true" />
                        <p className="text-sm">ยังไม่มีข้อความ Broadcast</p>
                        <Link
                          href="/admin/chatbot/broadcast/new"
                          className="inline-flex min-h-touch items-center gap-1.5 rounded-md border border-border bg-transparent px-4 text-sm font-semibold text-ink"
                        >
                          <Plus className="h-4 w-4" /> สร้างข้อความแรก
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => {
                    const st = STATUS_MAP[item.status] ?? STATUS_MAP.draft!;
                    const Icon = st.icon;
                    return (
                      <tr key={item.id} className="hover:bg-accent/5">
                        <td className="max-w-60 px-4 py-3">
                          <Link href={`/admin/chatbot/broadcast/${item.id}`} className="truncate text-sm font-medium text-accent-strong hover:underline">
                            {broadcastName(item)}
                          </Link>
                          <p className="mt-0.5 text-xs text-muted">
                            {item.target?.kind === 'line_user_ids'
                              ? `เฉพาะกลุ่ม ${item.target.ids.length} คน`
                              : 'ผู้ติดตามทั้งหมด'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted">{broadcastType(item)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${st.cls}`}>
                            <Icon className="h-3.5 w-3.5" /> {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted">
                          {item.status === 'sent' && item.totalRecipients > 0 ? (
                            <span>
                              <span className="font-medium text-success">{item.successCount} สำเร็จ</span>
                              {item.failedCount > 0 && <span className="text-danger"> / {item.failedCount} ล้มเหลว</span>}
                            </span>
                          ) : item.target?.kind === 'line_user_ids' ? (
                            `${item.target.ids.length} คน`
                          ) : (
                            'ผู้ติดตามทุกคน'
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                          {item.sentAt
                            ? new Date(item.sentAt).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                            : item.scheduledAt
                              ? new Date(item.scheduledAt).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                              : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {(item.status === 'draft' || item.status === 'scheduled') && (
                            <Button variant="outline" onClick={() => handleSend(item)} className="min-h-touch gap-1 text-sm">
                              <Send className="h-3.5 w-3.5" /> ส่งเลย
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>สร้างประกาศใหม่</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="bc-msg">ข้อความประกาศ</Label>
              <Textarea id="bc-msg" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="เช่น ประกาศ: อบต.หัวงัวปิดทำการวันที่ 12 ส.ค." />
            </div>
            <div>
              <Label>กลุ่มผู้รับ</Label>
              <div className="mt-1 flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" aria-label="ผู้ติดตามทุกคน" name="bc-target" checked={targetKind === 'all'} onChange={() => { setTargetKind('all'); setEstimate(null); }} />
                  ผู้ติดตามทุกคน
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" aria-label="เลือกเฉพาะราย" name="bc-target" checked={targetKind === 'specific'} onChange={() => { setTargetKind('specific'); setEstimate(null); }} />
                  เลือกเฉพาะราย
                </label>
              </div>
              {targetKind === 'specific' && (
                <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {recipientOptions.length === 0 ? (
                    <p className="text-sm text-muted">ยังไม่มีผู้ใช้ LINE ในระบบ</p>
                  ) : recipientOptions.map((opt) => (
                    <label key={opt.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        aria-label={opt.displayName ?? opt.id}
                        checked={selectedIds.includes(opt.id)}
                        onChange={(e) => {
                          setEstimate(null);
                          setSelectedIds((prev) => e.target.checked ? [...prev, opt.id] : prev.filter((x) => x !== opt.id));
                        }}
                      />
                      {opt.displayName ?? '(ไม่มีชื่อ)'}
                    </label>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center gap-3">
                <Button type="button" variant="outline" onClick={refreshEstimate}>ประเมินจำนวนผู้รับ</Button>
                {estimate !== null && <span className="text-sm text-muted">ประมาณ {estimate} คน</span>}
              </div>
            </div>
            <div>
              <Label htmlFor="bc-schedule">ตั้งเวลาส่ง (เว้นว่าง = สร้างเป็นร่าง)</Label>
              <input
                aria-label="ตั้งเวลาส่ง (เว้นว่าง = สร้างเป็นร่าง)"
                id="bc-schedule"
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                aria-describedby="bc-schedule-hint"
                className="min-h-touch w-full rounded-md border border-border bg-surface-raised px-4 text-ink"
              />
              <FieldHint id="bc-schedule-hint">
                ระบบตรวจคิวทุก {SEND_WINDOW_MINUTES} นาที ประกาศจึงอาจออกช้ากว่าเวลาที่ตั้งได้ถึง{' '}
                {SEND_WINDOW_MINUTES} นาที — ถ้าต้องการให้ออกทันที ให้สร้างเป็นร่างแล้วกดปุ่มส่ง
              </FieldHint>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'สร้าง'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
