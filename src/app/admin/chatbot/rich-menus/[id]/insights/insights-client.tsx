'use client';

import Link from 'next/link';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { adminApi, type RichMenuItem } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';

export function RichMenuInsightsClient({ menuId }: { menuId: string }) {
  // § หัวงัวไม่มี LINE insight backend (JSk ดึง Official API) — หน้านี้ยืนยันเมนู + สถานะ sync/publish
  const { data, loading } = useResource({ load: adminApi.listRichMenus });
  const item: RichMenuItem | null = (data?.items ?? []).find((m) => m.id === menuId) ?? null;

  if (loading) return <div className="py-12 text-center text-muted">กำลังโหลด...</div>;
  if (!item) return <div className="py-12 text-center text-muted">ไม่พบเมนูนี้</div>;

  return (
    <div className="space-y-4">
      <Link href="/admin/chatbot/rich-menus" className="inline-flex min-h-touch items-center gap-1.5 text-sm font-semibold text-accent-strong">
        <ArrowLeft className="h-4 w-4" /> กลับไปรายการ
      </Link>
      <AdminCard>
        <AdminCardTitle icon={<BarChart3 className="h-4 w-4" />}>สถานะเมนู: {item.name}</AdminCardTitle>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Chat bar text</dt><dd className="font-medium text-ink">{item.chatBarText}</dd></div>
          <div><dt className="text-muted">LINE Rich Menu ID</dt><dd className="font-mono text-xs text-ink">{item.lineRichMenuId ?? 'LOCAL_ONLY'}</dd></div>
          <div><dt className="text-muted">สถานะ</dt><dd className="text-ink">{item.status}</dd></div>
          <div><dt className="text-muted">Sync</dt><dd className="text-ink">{item.syncStatus}{item.lastSyncError ? ` — ${item.lastSyncError}` : ''}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted">
          สถิติรายปุ่ม (coming soon) — สถิติการแตะต้องดึงจาก LINE Official Account Manager หน้านี้แสดงสถานะเมนูจากระบบก่อน
        </p>
      </AdminCard>
    </div>
  );
}
