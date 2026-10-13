'use client';

import { useState } from 'react';
import type { RichMenuItem } from '@/app/admin/_lib/admin-api';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import { useRef } from 'react';
import { Plus, RefreshCw, Globe, ImageUp, LayoutGrid } from 'lucide-react';
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

// § template เมนูบริการงานช่าง อบต.หัวงัว 6 ช่อง (2500×1686) — 5 ปุ่ม uri เปิด LIFF
// + ปุ่มติดต่อเจ้าหน้าที่ (message → บอทตอบ Flex handoff)
// แทน <LIFF_ID> ด้วยค่า LINE_LIFF_ID ก่อน Sync (ดู .env.example หัวข้อ LIFF)
// ?category=<slug> จะ preselect หมวดใน /intake ให้อัตโนมัติ (slug ผิด → ฟอร์มว่าง)
const DEFAULT_CONFIG = JSON.stringify({
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'เมนูบริการงานช่าง อบต.หัวงัว',
  chatBarText: 'เมนูหลัก',
  areas: [
    { bounds: { x: 0, y: 0, width: 833, height: 843 }, action: { type: 'uri', uri: 'https://liff.line.me/<LIFF_ID>/intake?category=roads-sidewalks' } },
    { bounds: { x: 833, y: 0, width: 833, height: 843 }, action: { type: 'uri', uri: 'https://liff.line.me/<LIFF_ID>/intake?category=electricity-lighting' } },
    { bounds: { x: 1666, y: 0, width: 834, height: 843 }, action: { type: 'uri', uri: 'https://liff.line.me/<LIFF_ID>/intake?category=water-supply' } },
    { bounds: { x: 0, y: 843, width: 833, height: 843 }, action: { type: 'uri', uri: 'https://liff.line.me/<LIFF_ID>/intake' } },
    { bounds: { x: 833, y: 843, width: 833, height: 843 }, action: { type: 'uri', uri: 'https://liff.line.me/<LIFF_ID>/track' } },
    { bounds: { x: 1666, y: 843, width: 834, height: 843 }, action: { type: 'message', text: 'ติดต่อเจ้าหน้าที่' } },
  ],
}, null, 2);

export function RichMenusClient() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [chatBarText, setChatBarText] = useState('เมนูหลัก');
  const [displayStart, setDisplayStart] = useState('');
  const [displayEnd, setDisplayEnd] = useState('');
  const [configJson, setConfigJson] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<RichMenuItem | null>(null);

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
      () =>
        adminApi.createRichMenu({
          name: name.trim(),
          chatBarText,
          config,
          ...(displayStart ? { displayStartAt: new Date(displayStart).toISOString() } : {}),
          ...(displayEnd ? { displayEndAt: new Date(displayEnd).toISOString() } : {}),
        }),
      'สร้าง Rich Menu สำเร็จ',
    );
    setSaving(false);
    if (ok) {
      setDialogOpen(false);
      setName('');
      setDisplayStart('');
      setDisplayEnd('');
    }
  }

  async function handleSync(item: RichMenuItem) {
    await mutate(() => adminApi.syncRichMenu(item.id), 'Sync สำเร็จ');
  }

  function pickImage(item: RichMenuItem) {
    uploadTargetRef.current = item;
    fileRef.current?.click();
  }

  async function handleImagePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const item = uploadTargetRef.current;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!item || !file) return;
    setUploadingId(item.id);
    await mutate(() => adminApi.uploadRichMenuImage(item.id, file), 'อัปรูพสำเร็จ — รูปขึ้น LINE แล้ว');
    setUploadingId(null);
  }

  const [aliasId, setAliasId] = useState('');
  const [aliasTarget, setAliasTarget] = useState('');
  const aliasesRes = useResource({ load: adminApi.listMenuAliases });
  const aliases = aliasesRes.data?.items ?? [];
  const reloadAliases = aliasesRes.reload;
  const syncedMenus = items.filter((m) => m.lineRichMenuId && m.syncStatus === 'synced');

  async function handleCreateAlias() {
    if (!aliasId.trim() || !aliasTarget) {
      notify('error', 'กรอกชื่อ alias และเลือกเมนูเป้าหมาย');
      return;
    }
    const ok = await mutate(() => adminApi.createMenuAlias(aliasId.trim(), aliasTarget), 'สร้าง alias สำเร็จ');
    if (ok) {
      setAliasId('');
      await reloadAliases();
    }
  }

  async function handleRepoint(alias: string, menuId: string) {
    if (!menuId) return;
    if (await mutate(() => adminApi.repointMenuAlias(alias, menuId), `ย้าย alias ${alias} แล้ว`)) {
      await reloadAliases();
    }
  }

  async function handleDeleteAlias(alias: string) {
    if (!confirm(`ลบ alias "${alias}" บน LINE ด้วย?`)) return;
    if (await mutate(() => adminApi.deleteMenuAlias(alias), 'ลบ alias สำเร็จ')) {
      await reloadAliases();
    }
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

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg"
        aria-label="เลือกไฟล์รูปเมนู"
        className="hidden"
        onChange={handleImagePicked}
      />
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
          <div className="py-12 text-center text-muted">ยังไม่มี Rich Menu — กด &quot;สร้าง&quot; เพื่อเริ่ม</div>
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
                {(item.displayStartAt || item.displayEndAt) && (
                  <span className="rounded-full bg-muted/10 px-2 py-0.5 text-xs font-medium text-muted" title="cron แสดง/ปลดเมนูตามเวลานี้อัตโนมัติ">
                    ⏰ ตามเวลา
                  </span>
                )}
                <div className="flex gap-1">
                  <Button variant="outline" onClick={() => handleSync(item)} className="min-h-touch gap-1 text-xs">
                    <RefreshCw className="h-3.5 w-3.5" /> Sync
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => pickImage(item)}
                    disabled={!item.lineRichMenuId || uploadingId === item.id}
                    title={item.lineRichMenuId ? 'อัปรูปเมนู (PNG/JPEG ไม่เกิน 1MB)' : 'ต้อง Sync ก่อนอัปโหลดรูป'}
                    className="min-h-touch gap-1 text-xs"
                  >
                    <ImageUp className="h-3.5 w-3.5" /> {uploadingId === item.id ? 'กำลังอัป...' : 'อัปรูป'}
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

      <AdminCard>
        <AdminCardTitle icon={<LayoutGrid className="h-4 w-4" />}>
          Aliases ({aliases.length}) — สลับ tab ด้วย richmenuswitch
        </AdminCardTitle>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label="ชื่อ alias"
            value={aliasId}
            onChange={(e) => setAliasId(e.target.value)}
            placeholder="เช่น main-menu (a-z 0-9 _ -)"
            className="flex-1"
          />
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
          <Button onClick={handleCreateAlias} className="min-h-touch gap-1.5"><Plus className="h-4 w-4" /> สร้าง alias</Button>
        </div>
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
                <Button variant="outline" onClick={() => handleDeleteAlias(a.aliasId)} className="min-h-touch text-xs">ลบ</Button>
              </div>
            </div>
          ))}
          {aliases.length === 0 && (
            <p className="py-4 text-center text-sm text-muted">ยังไม่มี alias — ปุ่ม richmenuswitch ในเมนูอ้างชื่อนี้เพื่อสลับ tab</p>
          )}
        </div>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="rm-start">เริ่มแสดง (ไม่บังคับ)</Label>
                <Input id="rm-start" type="datetime-local" value={displayStart} onChange={(e) => setDisplayStart(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="rm-end">สิ้นสุด (ไม่บังคับ)</Label>
                <Input id="rm-end" type="datetime-local" value={displayEnd} onChange={(e) => setDisplayEnd(e.target.value)} />
              </div>
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
