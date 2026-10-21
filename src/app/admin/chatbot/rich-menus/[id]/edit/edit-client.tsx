'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { adminApi, type RichMenuItem } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { Button } from '@/components/ui/button';

export function RichMenuEditClient({ menuId }: { menuId: string }) {
  const { data, loading, feedback } = useResource({ load: adminApi.listRichMenus });
  const item: RichMenuItem | null = (data?.items ?? []).find((m) => m.id === menuId) ?? null;

  const [syncing, setSyncing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // § PATCH server รับแค่ display window (name/chatBarText แก้ไม่ได้) — หน้านี้จึงเป็น
  // ศูนย์ sync/publish/upload ไม่ใช่ฟอร์มแก้ชื่อ (เปลี่ยนโครงต้อง builder ใหม่)
  async function handleSync() {
    if (!item) return;
    setSyncing(true);
    setFormError(null);
    const res = await adminApi.syncRichMenu(item.id);
    setSyncing(false);
    if (!res.ok) setFormError(res.error);
  }

  if (loading) return <div className="py-12 text-center text-muted">กำลังโหลด...</div>;
  if (!item) return <div className="py-12 text-center text-muted">ไม่พบเมนูนี้</div>;

  return (
    <div className="space-y-4">
      <Link href="/admin/chatbot/rich-menus" className="inline-flex min-h-touch items-center gap-1.5 text-sm font-semibold text-accent-strong">
        <ArrowLeft className="h-4 w-4" /> กลับไปรายการ
      </Link>
      {feedback && (
        <div role="status" className={`rounded-lg px-4 py-3 text-sm font-medium ${feedback.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
          {feedback.msg}
        </div>
      )}
      {formError && (
        <p role="alert" className="rounded-lg bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{formError}</p>
      )}
      <AdminCard>
        <AdminCardTitle>แก้ไขเมนู: {item.name}</AdminCardTitle>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">ชื่อเมนู</dt><dd className="font-medium text-ink">{item.name}</dd></div>
          <div><dt className="text-muted">Chat Bar Text</dt><dd className="text-ink">{item.chatBarText}</dd></div>
          <div><dt className="text-muted">LINE ID</dt><dd className="font-mono text-xs text-ink">{item.lineRichMenuId ?? 'LOCAL_ONLY'}</dd></div>
          <div><dt className="text-muted">Sync</dt><dd className="text-ink">{item.syncStatus}{item.lastSyncError ? ` — ${item.lastSyncError}` : ''}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted">
          เปลี่ยนชื่อ/โครงเมนูให้สร้างใหม่ที่หน้า New แล้ว sync/publish ที่นี่ — PATCH server รับแค่ display window
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleSync} disabled={syncing || !item.lineRichMenuId} className="gap-1.5">
            <RefreshCw className="h-4 w-4" /> {syncing ? 'กำลังซิงค์...' : 'ซิงค์ไป LINE'}
          </Button>
          <Link href="/admin/chatbot/rich-menus/new" className="inline-flex min-h-touch items-center rounded-md border border-border px-4 text-sm font-semibold text-ink">
            สร้างเมนูใหม่
          </Link>
        </div>
      </AdminCard>
      <div>
        <Link href="/admin/chatbot/rich-menus" className="inline-flex min-h-touch items-center rounded-md border border-border px-4 text-sm font-semibold text-ink">
          กลับไปรายการ
        </Link>
      </div>
    </div>
  );
}
