'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { isValidAliasId } from '@/lib/contracts';
import { isSyncedMenu } from '../rich-menu-state';
import { useResource } from '@/app/admin/_lib/use-resource';
import { PageHeader } from '@/components/admin/page-header';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { cn } from '@/lib/cn';


export function RichMenuAliasesClient() {
  const [aliasId, setAliasId] = useState('');
  const [aliasTarget, setAliasTarget] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const menusRes = useResource({ load: adminApi.listRichMenus });
  const aliasesRes = useResource({ load: adminApi.listMenuAliases });
  const items = menusRes.data?.items ?? [];
  const aliases = aliasesRes.data?.items ?? [];
  const loading = menusRes.loading || aliasesRes.loading;
  const syncedMenus = items.filter(isSyncedMenu);

  async function handleCreate() {
    if (!isValidAliasId(aliasId.trim())) {
      setFormError('alias id ใช้ได้เฉพาะ a-z A-Z 0-9 _ - ความยาว 1-50 ตัว');
      return;
    }
    if (!aliasTarget) {
      setFormError('เลือกเมนูที่ sync ไป LINE แล้วเป็นปลายทาง');
      return;
    }
    setFormError(null);
    setCreating(true);
    const res = await adminApi.createMenuAlias(aliasId.trim(), aliasTarget);
    setCreating(false);
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
    if (!res.ok) {
      setFormError(res.error);
      await aliasesRes.reload();
      return;
    }
    await aliasesRes.reload();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await adminApi.deleteMenuAlias(deleteTarget);
    setDeleting(false);
    setDeleteTarget(null);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    await aliasesRes.reload();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rich Menu Aliases"
        subtitle="ชื่อย่อสำหรับสลับเมนูแบบแท็บ (richmenuswitch)"
      >
        <Link href="/admin/chatbot/rich-menus">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> กลับไปหน้าเมนู
          </Button>
        </Link>
      </PageHeader>

      {formError && (
        <p role="alert" className="rounded-lg bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          {formError}
        </p>
      )}

      <div className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-sm font-bold text-ink">สร้าง Alias ใหม่</h2>
        {syncedMenus.length === 0 && !loading ? (
          <p className="text-xs text-warning-ink">
            ยังไม่มีเมนูที่ sync ไป LINE —{' '}
            <Link href="/admin/chatbot/rich-menus" className="font-bold underline">
              sync เมนูอย่างน้อย 1 อัน
            </Link>{' '}
            ก่อนจึงจะสร้าง alias ได้
          </p>
        ) : (
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label htmlFor="alias-id" className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Alias ID
              </label>
              <Input
                id="alias-id"
                value={aliasId}
                onChange={(e) => setAliasId(e.target.value)}
                placeholder="เช่น menu-a (a-z 0-9 _ -)"
                className="mt-1"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="alias-target" className="text-[10px] font-bold uppercase tracking-wider text-muted">
                ชี้ไปที่เมนู
              </label>
              <select
                id="alias-target"
                aria-label="เมนูเป้าหมาย"
                value={aliasTarget}
                onChange={(e) => setAliasTarget(e.target.value)}
                className="mt-1 min-h-touch w-full rounded-lg border border-border bg-surface px-3 text-sm"
              >
                <option value="">-- เลือกเมนู --</option>
                {syncedMenus.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <Button onClick={handleCreate} disabled={creating} className="gap-1.5">
              <Plus className="h-4 w-4" /> {creating ? 'กำลังสร้าง...' : 'สร้าง'}
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-muted">กำลังโหลดข้อมูล...</p>
      ) : aliases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted">ยังไม่มี alias ในระบบ</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left">
              <thead>
                <tr className="border-b border-border/50 text-xs font-semibold uppercase tracking-wide text-muted">
                  <th scope="col" className="px-4 py-3">Alias ID</th>
                  <th scope="col" className="px-4 py-3">ชี้ไปที่เมนู</th>
                  <th scope="col" className="px-4 py-3 text-center">สถานะ Sync</th>
                  <th scope="col" className="px-4 py-3 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {aliases.map((alias) => (
                  <tr key={alias.aliasId} className="hover:bg-accent/5">
                    <td className="px-4 py-4 font-mono text-sm text-ink">{alias.aliasId}</td>
                    <td className="px-4 py-4">
                      <select
                        aria-label={`เมนูเป้าหมายของ ${alias.aliasId}`}
                        value={alias.richMenuId}
                        onChange={(e) => void handleRepoint(alias.aliasId, e.target.value)}
                        className="min-h-touch rounded-lg border border-border bg-surface px-2 text-sm"
                      >
                        {!syncedMenus.some((m) => m.id === alias.richMenuId) && (
                          <option value={alias.richMenuId}>{alias.menuName ?? alias.richMenuId}</option>
                        )}
                        {syncedMenus.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[10px] font-bold',
                          alias.syncStatus === 'synced'
                            ? 'border-success/30 bg-success-soft text-success-ink'
                            : 'border-warning/40 bg-warning-soft text-warning-ink',
                        )}
                      >
                        {(alias.syncStatus ?? 'pending').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        type="button"
                        aria-label={`ลบ alias ${alias.aliasId}`}
                        onClick={() => setDeleteTarget(alias.aliasId)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-danger hover:bg-danger/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="ยืนยันการลบ Alias"
        description="ลบ alias นี้แล้วพื้นที่เมนูที่ตั้งเป็น 'สลับเมนู' ไปยัง alias นี้จะใช้ไม่ได้ ต้องการลบหรือไม่?"
        confirmText="ลบ"
        danger
        busy={deleting}
      />
    </div>
  );
}
