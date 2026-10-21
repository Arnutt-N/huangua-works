'use client';

import Link from 'next/link';
import { ArrowLeft, RefreshCw, UserRound } from 'lucide-react';
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
  const { data, loading, reload } = useResource({ load: adminApi.listFriends });
  const item: FriendItem | null = (data?.items ?? []).find((f) => f.id === friendId) ?? null;

  // § listFriends มี pagination — detail หาใน pageSize 100 (เพื่อนไม่ถึงหลักร้อยใน อบต.)
  const { data: full } = useResource({
    load: () => adminApi.listFriends('page=1&pageSize=100'),
  });
  const fullItem: FriendItem | null =
    item ?? (full?.items ?? []).find((f) => f.id === friendId) ?? null;

  if (loading && !fullItem) return <div className="py-12 text-center text-muted">กำลังโหลด...</div>;
  if (!fullItem) return <div className="py-12 text-center text-muted">ไม่พบเพื่อนคนนี้</div>;

  return (
    <div className="space-y-4">
      <Link href="/admin/friends" className="inline-flex min-h-touch items-center gap-1.5 text-sm font-semibold text-accent-strong">
        <ArrowLeft className="h-4 w-4" /> กลับไปรายการ
      </Link>
      <AdminCard>
        <AdminCardTitle
          icon={<UserRound className="h-4 w-4" />}
          action={
            <Button variant="outline" onClick={() => reload()} className="min-h-touch gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" /> รีเฟรช
            </Button>
          }
        >
          {fullItem.displayName ?? 'ไม่ระบุชื่อ'}
        </AdminCardTitle>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">ID (ปกปิด)</dt><dd className="font-mono text-xs text-ink">{fullItem.maskedId ?? '—'}</dd></div>
          <div><dt className="text-muted">สถานะ</dt><dd className="text-ink">{fullItem.followState === 'following' ? 'ติดตามอยู่' : 'เลิกติดตาม'}</dd></div>
          <div><dt className="text-muted">ติดตาม / กลับมา</dt><dd className="text-ink">{fullItem.followCount} / {fullItem.refollowCount}{fullItem.refollowCount > 0 ? ` (กลับมา ${fullItem.refollowCount} ครั้ง)` : ''}</dd></div>
          <div><dt className="text-muted">เคลื่อนไหวล่าสุด</dt><dd className="text-ink">{formatThaiDateTime(fullItem.lastActiveAt)}</dd></div>
          <div><dt className="text-muted">Rich Menu</dt><dd className="text-ink">{fullItem.richMenuName ?? 'เมนูหลัก'}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted">
          กำหนด/ปลดริชเมนูที่ตารางหน้ารายการ — ID เต็มถูกปกปิดตาม PDPA (Personal Data Protection Act) ไม่แสดงที่นี่
        </p>
      </AdminCard>
    </div>
  );
}
