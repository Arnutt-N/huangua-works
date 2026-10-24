'use client';

import Link from 'next/link';
import { ArrowLeft, RefreshCw, UserMinus, UserPlus, UserRound } from 'lucide-react';
import { adminApi, type FriendItem } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { Button } from '@/components/ui/button';

function formatThaiDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

export function FriendDetailClient({ friendId }: { friendId: string }) {
  // § hook เดียวก้อน 100 — เคยมี 2 hooks (page 20 + 100) loading ดูก้อนแรกแต่แสดงก้อนสอง
  // เพื่อนนอก 20 แรกแวบ "ไม่พบ" เท็จ ปุ่มรีเฟรช reload ก้อนที่ไม่ได้แสดง
  const friend = useResource({
    load: () => adminApi.getFriend(friendId),
  });
  const item: FriendItem | null = friend.data ?? null;
  const events = useResource({ load: () => adminApi.listFriendEvents(friendId) });
  const timeline = [...(events.data?.items ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  if (friend.loading && !item) return <div className="py-12 text-center text-muted">กำลังโหลด...</div>;
  if (!item) return <div className="py-12 text-center text-muted">ไม่พบเพื่อนคนนี้</div>;

  return (
    <div className="space-y-4">
      <Link href="/admin/friends" className="inline-flex min-h-touch items-center gap-1.5 text-sm font-semibold text-accent-strong">
        <ArrowLeft className="h-4 w-4" /> กลับไปรายการ
      </Link>
      <AdminCard>
        <AdminCardTitle
          icon={<UserRound className="h-4 w-4" />}
          action={
            <Button variant="outline" onClick={() => { friend.reload(); events.reload(); }} className="min-h-touch gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" /> รีเฟรช
            </Button>
          }
        >
          {item.displayName ?? 'ไม่ระบุชื่อ'}
        </AdminCardTitle>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">ID (ปกปิด)</dt><dd className="font-mono text-xs text-ink">{item.maskedId ?? '—'}</dd></div>
          <div><dt className="text-muted">สถานะ</dt><dd className="text-ink">{item.followState === 'following' ? 'ติดตามอยู่' : 'เลิกติดตาม'}</dd></div>
          <div><dt className="text-muted">เริ่มติดตาม</dt><dd className="text-ink">{formatThaiDateTime(item.since)}</dd></div>
          <div><dt className="text-muted">ติดตาม / กลับมา</dt><dd className="text-ink">{item.followCount} / {item.refollowCount}{item.refollowCount > 0 ? ` (กลับมา ${item.refollowCount} ครั้ง)` : ''}</dd></div>
          <div><dt className="text-muted">เคลื่อนไหวล่าสุด</dt><dd className="text-ink">{formatThaiDateTime(item.lastActiveAt)}</dd></div>
          <div><dt className="text-muted">Rich Menu</dt><dd className="text-ink">{item.richMenuName ?? 'เมนูหลัก'}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted">
          กำหนด/ปลดริชเมนูที่ตารางหน้ารายการ — ID เต็มถูกปกปิดตาม PDPA (Personal Data Protection Act) ไม่แสดงที่นี่
        </p>
      </AdminCard>

      {timeline.length > 0 && (
        <AdminCard>
          <h2 className="mb-4 text-base font-bold text-ink">ประวัติเหตุการณ์</h2>
          <ol aria-label="ประวัติเหตุการณ์ของเพื่อน">
            {timeline.map((e) => (
              <li key={e.id} className="flex gap-3 border-b border-border/30 py-3 last:border-0">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-pill ${
                    e.event === 'follow' ? 'bg-success-soft text-success-ink' : 'bg-surface-sunken text-muted'
                  }`}
                >
                  {e.event === 'follow' ? <UserPlus className="h-4 w-4" /> : <UserMinus className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink">
                    {e.event === 'follow' ? 'เริ่มติดตาม' : 'ยกเลิกติดตาม'}
                  </span>
                  <span className="block text-[11px] text-muted">{formatThaiDateTime(e.createdAt)}</span>
                </span>
              </li>
            ))}
          </ol>
        </AdminCard>
      )}
    </div>
  );
}
