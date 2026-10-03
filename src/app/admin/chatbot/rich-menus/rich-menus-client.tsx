'use client';

import { useState } from 'react';
import type { RichMenuItem } from '@/app/admin/_lib/admin-api';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import { Plus, RefreshCw, Globe, LayoutGrid } from 'lucide-react';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label, Input, Textarea } from '@/components/ui/field';

const DEFAULT_CONFIG = JSON.stringify({
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'Main Menu',
  chatBarText: 'เมนูหลัก',
  areas: [
    { bounds: { x: 0, y: 0, width: 1250, height: 843 }, action: { type: 'message', text: 'แจ้งเรื่องใหม่' } },
    { bounds: { x: 1250, y: 0, width: 1250, height: 843 }, action: { type: 'message', text: 'ติดตามเรื่อง' } },
    { bounds: { x: 0, y: 843, width: 1250, height: 843 }, action: { type: 'message', text: 'ติดต่อเจ้าหน้าที่' } },
    { bounds: { x: 1250, y: 843, width: 1250, height: 843 }, action: { type: 'message', text: 'คำถามที่พบบ่อย' } },
  ],
}, null, 2);

export function RichMenusClient() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [chatBarText, setChatBarText] = useState('เมนูหลัก');
  const [configJson, setConfigJson] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);

  const { data, loading, feedback, notify, mutate } = useResource({
    load: adminApi.listRichMenus,
  });
  const items = data?.items ?? [];

  async function handleCreate() {
    if (!name.trim()) {
      notify('error', 'กรุณากรอกชื่อ');
      return;
    }
    let config: unknown;
    try {
      config = JSON.parse(configJson);
    } catch {
      notify('error', 'Config JSON ไม่ถูกต้อง');
      return;
    }

    setSaving(true);
    const ok = await mutate(
      () => adminApi.createRichMenu({ name: name.trim(), chatBarText, config }),
      'สร้าง Rich Menu สำเร็จ',
    );
    setSaving(false);
    if (ok) {
      setDialogOpen(false);
      setName('');
    }
  }

  async function handleSync(item: RichMenuItem) {
    await mutate(() => adminApi.syncRichMenu(item.id), 'Sync สำเร็จ');
  }

  async function handlePublish(item: RichMenuItem) {
    if (!confirm(`Publish "${item.name}" ให้ผู้ใช้ LINE ทุกคน?`)) return;
    // server คืน 422 { error } เมื่อ LINE ปฏิเสธ — mutate เอาข้อความนั้นมาแจ้ง
    await mutate(() => adminApi.publishRichMenu(item.id), 'Publish สำเร็จ — ผู้ใช้ทุกคนจะเห็นเมนูใหม่');
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
          icon={<LayoutGrid className="h-4 w-4" />}
          action={<Button onClick={() => setDialogOpen(true)} className="min-h-touch gap-1.5"><Plus className="h-4 w-4" /> สร้าง</Button>}
        >
          Rich Menus ({items.length})
        </AdminCardTitle>

        {loading ? (
          <div className="py-12 text-center text-muted">กำลังโหลด...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-muted">ยังไม่มี Rich Menu — กด "สร้าง" เพื่อเริ่ม</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border/50 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{item.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {item.lineRichMenuId ? `LINE ID: ${item.lineRichMenuId}` : 'ยังไม่ได้ sync'}
                    {item.lastSyncError && <span className="text-danger"> · {item.lastSyncError}</span>}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted/10 text-muted'}`}>
                  {item.status === 'active' ? 'ใช้งาน' : item.status}
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" onClick={() => handleSync(item)} className="min-h-touch gap-1 text-xs">
                    <RefreshCw className="h-3.5 w-3.5" /> Sync
                  </Button>
                  <Button variant="outline" onClick={() => handlePublish(item)} className="min-h-touch gap-1 text-xs" disabled={!item.lineRichMenuId}>
                    <Globe className="h-3.5 w-3.5" /> Publish
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>สร้าง Rich Menu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="rm-name">ชื่อเมนู</Label>
              <Input id="rm-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Main Menu v2" />
            </div>
            <div>
              <Label htmlFor="rm-bar">Chat Bar Text</Label>
              <Input id="rm-bar" value={chatBarText} onChange={(e) => setChatBarText(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="rm-config">Config (LINE Rich Menu JSON)</Label>
              <Textarea id="rm-config" rows={10} value={configJson} onChange={(e) => setConfigJson(e.target.value)} className="font-mono text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'กำลังสร้าง...' : 'สร้าง'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
