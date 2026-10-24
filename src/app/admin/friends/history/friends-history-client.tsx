'use client';

import { UserPlus, UserMinus } from 'lucide-react';
import { AdminCard } from '@/components/admin/admin-card';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/admin/empty-state';
import { useResource } from '@/app/admin/_lib/use-resource';
import { adminApi, type FriendEventItem } from '@/app/admin/_lib/admin-api';

function formatThaiDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

function nameOf(e: FriendEventItem): string {
  return e.displayName ?? `เพื่อน ${e.maskedId ?? 'ไม่ระบุ'}`;
}

/**
 * § timeline เหตุการณ์เพิ่ม/ยกเลิกติดตาม — ตามโครง "ประวัติ" ของ jsk แต่ map กับข้อมูลจริง
 * ของ huangua (lineFriendEvents มีแค่ follow/unfollow; LINE ไม่ส่ง block event เข้า webhook
 * ของเรา) จึงมีสองประเภทเท่านั้น
 */
export function FriendsHistoryClient() {
  const { data, loading } = useResource({ load: adminApi.listFriendEvents });
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="ประวัติเพื่อน" subtitle="ประวัติการเพิ่มเพื่อนและการเปลี่ยนแปลง" />

      <AdminCard>
        <h2 className="mb-4 text-base font-bold text-ink">เหตุการณ์ล่าสุด</h2>
        {loading ? (
          <p className="py-12 text-center text-sm text-muted">กำลังโหลด...</p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="ยังไม่มีเหตุการณ์"
            description="เมื่อมีคนกดเพิ่มเพื่อนหรือยกเลิกติดตาม จะบันทึกที่นี่"
          />
        ) : (
          <ol className="space-y-0">
            {items.map((e) => (
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
                  <span className="block text-sm">
                    <span className="font-semibold text-ink">{nameOf(e)}</span>{' '}
                    {e.event === 'follow' ? 'เริ่มติดตาม' : 'ยกเลิกติดตาม'}
                    {e.maskedId && (
                      <span className="ml-2 font-mono text-[10px] tabular-nums text-muted">{e.maskedId}</span>
                    )}
                  </span>
                  <span className="block text-[11px] text-muted">{formatThaiDateTime(e.createdAt)}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </AdminCard>
    </div>
  );
}
