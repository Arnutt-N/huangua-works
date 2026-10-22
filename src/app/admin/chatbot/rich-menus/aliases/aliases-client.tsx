'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';

export function RichMenuAliasesClient() {
  const [aliasId, setAliasId] = useState('');
  const [aliasTarget, setAliasTarget] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const menusRes = useResource({ load: adminApi.listRichMenus });
  const aliasesRes = useResource({ load: adminApi.listMenuAliases });
  const items = menusRes.data?.items ?? [];
  const aliases = aliasesRes.data?.items ?? [];
  const loading = menusRes.loading || aliasesRes.loading;
  const syncedMenus = items.filter((m) => m.lineRichMenuId && m.syncStatus === 'synced');

  async function handleCreate() {
    if (!aliasId.trim() || !aliasTarget) {
      setFormError('กรอกชื่อ alias และเลือกเมนูเป้าหมาย');
      return;
    }
    setFormError(null);
    const res = await adminApi.createMenuAlias(aliasId.trim(), aliasTarget);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    setAliasId('');
    await aliasesRes.reload();
  }

  async function handleRepoint(alias: string, menuId: string) {
    if (!menuId) return;
    const res = await adminApi.repointMenuAlias(alias, menuId);
    if (!res.ok) return;
    await aliasesRes.reload();
  }

  async function handleDelete(alias: string) {
    if (!confirm(`ลบ alias "${alias}" บน LINE ด้วย?`)) return;
    const res = await adminApi.deleteMenuAlias(alias);
    if (!res.ok) return;
    await aliasesRes.reload();
  }

  return (
    <div className="space-y-4">
      <Link href="/admin/chatbot/rich-menus" className="inline-flex min-h-touch items-center gap-1.5 text-sm font-semibold text-accent-strong">
        <ArrowLeft className="h-4 w-4" /> กลับไปรายการ
      </Link>
      <AdminCard>
        <AdminCardTitle>Aliases — สลับ tab ด้วย richmenuswitch</AdminCardTitle>
        {formError && (
          <p role="alert" className="mb-3 rounded-lg bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
            {formError}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input aria-label="ชื่อ alias" value={aliasId} onChange={(e) => setAliasId(e.target.value)} placeholder="เช่น main-menu (a-z 0-9 _ -)" className="flex-1" />
          <select
            aria-label="เมนูเป้าหมาย"
            value={aliasTarget}
            onChange={(e) => setAliasTarget(e.target.value)}
            className="min-h-touch rounded-lg border border-border/50 bg-surface px-3 text-sm"
          >
            <option value="">เลือกเมนูที่ sync แล้ว</option>
            {syncedMenus.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <Button onClick={handleCreate} className="min-h-touch gap-1.5"><Plus className="h-4 w-4" /> สร้าง alias</Button>
        </div>
        {loading ? (
          <p className="py-6 text-center text-sm text-muted">กำลังโหลด...</p>
        ) : (
          <div className="mt-3 space-y-2">
            {aliases.map((a) => (
              <div key={a.aliasId} className="flex flex-col gap-2 rounded-lg border border-border/50 p-3 sm:flex-row sm:items-center">
                <code className="font-mono text-sm font-medium text-ink">{a.aliasId}</code>
                <span className="text-xs text-muted">→ {a.menuName ?? '(เมนูถูกลบ?)'}</span>
                <div className="flex gap-1 sm:ml-auto">
                  <select
                    aria-label={`ย้ายเป้า ${a.aliasId}`}
                    defaultValue=""
                    onChange={(e) => handleRepoint(a.aliasId, e.target.value)}
                    className="min-h-touch rounded-lg border border-border/50 bg-surface px-2 text-xs"
                  >
                    <option value="">ย้ายเป้า…</option>
                    {syncedMenus.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <Button variant="outline" onClick={() => handleDelete(a.aliasId)} className="min-h-touch text-xs">ลบ</Button>
                </div>
              </div>
            ))}
            {aliases.length === 0 && (
              <p className="py-4 text-center text-sm text-muted">ยังไม่มี alias — ปุ่ม richmenuswitch ในเมนูอ้างชื่อนี้เพื่อสลับ tab</p>
            )}
          </div>
        )}
      </AdminCard>
    </div>
  );
}
