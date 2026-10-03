'use client';

import { useState } from 'react';
import type { BroadcastItem } from '@/app/admin/_lib/admin-api';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import { Plus, Send, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
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

export function BroadcastClient() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, loading, feedback, notify, mutate } = useResource({
    load: adminApi.listBroadcasts,
  });
  const items = data?.items ?? [];

  async function handleCreate() {
    if (!message.trim()) {
      notify('error', 'กรุณากรอกข้อความ');
      return;
    }
    setSaving(true);
    const ok = await mutate(
      () =>
        adminApi.createBroadcast({
          content: [{ type: 'text', text: message.trim() }],
          scheduledAt: scheduleAt || null,
        }),
      scheduleAt ? 'ตั้งเวลาส่งแล้ว' : 'สร้างร่างสำเร็จ',
    );
    setSaving(false);
    if (ok) {
      setDialogOpen(false);
      setMessage('');
      setScheduleAt('');
    }
  }

  async function handleSend(item: BroadcastItem) {
    if (!confirm('ส่งประกาศหาผู้ติดตามทุกคนทันที?')) return;
    // server คืน 409 { error: 'ส่งแล้วหรือกำลังส่ง' } / 404 — mutate โชว์ข้อความนั้น
    await mutate(() => adminApi.sendBroadcast(item.id), 'ส่งประกาศสำเร็จ');
  }

  return (
    <>
      {feedback && (
        <div role="status" className={`rounded-lg px-4 py-3 text-sm font-medium ${feedback.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
          {feedback.msg}
        </div>
      )}

      <AdminCard>
        <AdminCardTitle
          icon={<Send className="h-4 w-4" />}
          action={<Button onClick={() => setDialogOpen(true)} className="min-h-touch gap-1.5"><Plus className="h-4 w-4" /> สร้างประกาศ</Button>}
        >
          ประวัติ Broadcast
        </AdminCardTitle>

        {loading ? (
          <div className="py-12 text-center text-muted">กำลังโหลด...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-muted">ยังไม่มีการส่งประกาศ</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const st = STATUS_MAP[item.status] ?? STATUS_MAP.draft!;
              const Icon = st.icon;
              const text = item.content[0]?.text ?? '';
              return (
                <div key={item.id} className="flex items-start gap-3 rounded-lg border border-border/50 p-4">
                  <Icon className={`mt-0.5 h-5 w-5 flex-none ${st.cls}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{text}</p>
                    <p className="mt-1 text-xs text-muted">
                      {st.label} · สร้าง {new Date(item.createdAt).toLocaleDateString('th-TH')}
                      {item.sentAt && ` · ส่ง ${new Date(item.sentAt).toLocaleString('th-TH')}`}
                      {item.totalRecipients > 0 && ` · ถึง ~${item.totalRecipients} คน`}
                    </p>
                  </div>
                  {(item.status === 'draft' || item.status === 'scheduled') && (
                    <Button variant="outline" onClick={() => handleSend(item)} className="min-h-touch flex-none gap-1 text-sm">
                      <Send className="h-3.5 w-3.5" /> ส่งเลย
                    </Button>
                  )}
                </div>
              );
            })}
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
              <Label htmlFor="bc-schedule">ตั้งเวลาส่ง (เว้นว่าง = สร้างเป็นร่าง)</Label>
              <input
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
