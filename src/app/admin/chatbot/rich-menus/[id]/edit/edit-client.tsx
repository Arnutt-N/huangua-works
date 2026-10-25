'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { adminApi, type RichMenuItemDetail, type RichMenuDisplayMode } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { Label, Input } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { areaStyle, toLineAction, validateArea, type RichMenuArea } from '../../rich-menu-templates';
import { fitRichMenuImage } from '../../rich-menu-image';
import {
  DISPLAY_MODE_LABEL,
  canPublish,
  menuStatusPill,
  needsResync,
  pillTone,
} from '../../rich-menu-state';
import { ThaiDateTimeField } from '../../thai-datetime-field';

const DISPLAY_MODES: RichMenuDisplayMode[] = ['ALWAYS', 'SCHEDULED', 'MANUAL'];

export function RichMenuEditClient({ menuId }: { menuId: string }) {
  const [menu, setMenu] = useState<RichMenuItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState('');
  const [chatBarText, setChatBarText] = useState('');
  const [areas, setAreas] = useState<RichMenuArea[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<RichMenuDisplayMode>('ALWAYS');
  const [displayStartAt, setDisplayStartAt] = useState<string | null>(null);
  const [displayEndAt, setDisplayEndAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'draft' | 'sync' | 'action' | null>(null);

  const aliasesRes = useResource({ load: adminApi.listMenuAliases });
  const aliases = aliasesRes.data?.items ?? [];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  function applyMenu(data: RichMenuItemDetail) {
    setMenu(data);
    setName(data.name);
    setChatBarText(data.chatBarText);
    setDisplayMode((data.displayMode as RichMenuDisplayMode) || 'ALWAYS');
    setDisplayStartAt(data.displayStartAt);
    setDisplayEndAt(data.displayEndAt);
    setAreas(
      (data.config?.areas ?? []).map((a, i) => ({
        label: `พื้นที่ ${i + 1}`,
        bounds: a.bounds,
        action: {
          type: (a.action.type as RichMenuArea['action']['type']) || 'uri',
          uri: a.action.uri ?? '',
          text: a.action.text ?? '',
          richMenuAliasId: a.action.richMenuAliasId ?? '',
        },
      })),
    );
    setImagePreview(data.lineRichMenuId ? `/api/line/admin/rich-menus/${data.id}/image` : null);
  }

  async function loadMenu() {
    const res = await adminApi.getRichMenu(menuId);
    if (!res.ok) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    applyMenu(res.data);
    setLoading(false);
  }

  // § setState ต้องอยู่ใน callback ของ timer/promise เท่านั้น (rule react-hooks/set-state-in-effect)
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void adminApi.getRichMenu(menuId).then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        applyMenu(res.data);
        setLoading(false);
      });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [menuId]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    setImagePreview(objectUrlRef.current);
  }

  function setAreaAction(index: number, patch: Partial<RichMenuArea['action']>) {
    setAreas((prev) =>
      prev.map((a, i) => (i === index ? { ...a, action: { ...a.action, ...patch } } : a)),
    );
  }

  function setAreaType(index: number, type: RichMenuArea['action']['type']) {
    setAreas((prev) =>
      prev.map((a, i) =>
        i === index ? { ...a, action: { type, uri: '', text: '', richMenuAliasId: '' } } : a,
      ),
    );
  }

  function validateAll(): string | null {
    if (!name.trim()) return 'กรุณากรอกชื่อเมนู';
    for (let i = 0; i < areas.length; i++) {
      const problem = validateArea(areas[i]!.action);
      if (problem) return `พื้นที่ ${i + 1}: ${problem}`;
    }
    if (displayMode === 'SCHEDULED') {
      if (!displayStartAt || !displayEndAt) return 'โหมด "ตามช่วงเวลา" ต้องระบุวันเวลาเริ่มต้นและสิ้นสุด';
      if (new Date(displayEndAt) <= new Date(displayStartAt)) return 'วันเวลาสิ้นสุดต้องอยู่หลังวันเวลาเริ่มต้น';
    }
    return null;
  }

  async function uploadImage() {
    if (!imageFile) return null;
    try {
      const fitted = await fitRichMenuImage(imageFile);
      const uploadFile =
        fitted.file instanceof File && !fitted.converted
          ? fitted.file
          : new File([fitted.file], fitted.filename, { type: 'image/jpeg' });
      const res = await adminApi.uploadRichMenuImage(menuId, uploadFile);
      return res.ok ? null : res.error;
    } catch (e) {
      return e instanceof Error ? e.message : 'รูปไม่พร้อมอัปโหลด';
    }
  }

  async function handleSave(andSync: boolean) {
    const problem = validateAll();
    if (problem) {
      setError(problem);
      return;
    }
    if (imageFile && !menu?.lineRichMenuId && !andSync) {
      setError('เมนูนี้ยังไม่ซิงค์ — ต้อง "บันทึกและซิงค์" ก่อนจึงอัปโหลดรูปได้');
      return;
    }

    setBusy(andSync ? 'sync' : 'draft');
    setError(null);

    const updated = await adminApi.updateRichMenu(menuId, {
      name: name.trim(),
      chatBarText: chatBarText.trim() || 'เมนูหลัก',
      areas: areas.map((a) => ({ bounds: a.bounds, action: toLineAction(a.action) })),
      displayMode,
      displayStartAt: displayMode === 'SCHEDULED' ? displayStartAt : null,
      displayEndAt: displayMode === 'SCHEDULED' ? displayEndAt : null,
    });
    if (!updated.ok) {
      setBusy(null);
      setError(updated.error);
      return;
    }

    if (andSync) {
      const synced = await adminApi.syncRichMenu(menuId);
      if (!synced.ok) {
        setBusy(null);
        setError(`บันทึกแล้ว แต่ซิงค์ไม่สำเร็จ: ${synced.error}`);
        await loadMenu();
        return;
      }
    }

    // § อัปรูปเฉพาะตอน "บันทึกและซิงค์" — LINE อัปเดตเมนูเดิมไม่ได้ sync ครั้งถัดไปจะ recreate
    // รูปที่อัปไปก่อนหน้าจะหายไปกับเมนูเดิม
    if (andSync) {
      const uploadError = await uploadImage();
      if (uploadError) {
        setBusy(null);
        setError(`บันทึกแล้ว แต่อัปรูปไม่สำเร็จ: ${uploadError}`);
        await loadMenu();
        return;
      }
    }

    if (andSync && displayMode === 'ALWAYS') {
      const published = await adminApi.publishRichMenu(menuId);
      if (!published.ok) {
        setBusy(null);
        setError(`ซิงค์แล้ว แต่ตั้งเป็นเมนูหลักไม่สำเร็จ: ${published.error}`);
        await loadMenu();
        return;
      }
    }

    setImageFile(null);
    setBusy(null);
    await loadMenu();
  }

  async function handleSyncAction() {
    setBusy('action');
    setError(null);
    const res = await adminApi.syncRichMenu(menuId);
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await loadMenu();
  }

  async function handlePublishAction() {
    setBusy('action');
    setError(null);
    const res = await adminApi.publishRichMenu(menuId);
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await loadMenu();
  }

  if (loading) return <div className="py-12 text-center text-muted">กำลังโหลด...</div>;
  if (notFound || !menu) return <div className="py-12 text-center text-muted">ไม่พบเมนูนี้</div>;

  const size = menu.config?.size ?? { width: 2500, height: 1686 };
  const pill = menuStatusPill(menu);
  const pendingResync = needsResync(menu);
  const action = !menu.lineRichMenuId
    ? 'sync'
    : pendingResync
      ? 'resync'
      : menu.syncStatus === 'error'
        ? 'resync'
        : canPublish(menu) && menu.status !== 'active'
          ? 'publish'
          : null;

  return (
    <div className="space-y-4">
      <PageHeader title="Edit Rich Menu" subtitle={`แก้ไขเมนู: ${menu.name}`}>
        <Link
          href="/admin/chatbot/rich-menus"
          aria-label="กลับ"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-accent-sunken hover:text-ink"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </PageHeader>

      {error && (
        <p role="alert" className="rounded-lg bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <div className="space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <Label htmlFor="rm-name">ชื่อเมนู</Label>
              <Input id="rm-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="rm-bar">Chat Bar Text</Label>
              <Input id="rm-bar" value={chatBarText} onChange={(e) => setChatBarText(e.target.value)} />
            </div>
            <div>
              <span className="block text-sm font-medium text-muted">สถานะ</span>
              <span
                title={pill.title}
                className={cn('mt-1 inline-block rounded-full border px-2.5 py-1 text-[10px] font-bold', pillTone[pill.tone])}
              >
                {pill.label}
              </span>
            </div>
            <div>
              <span className="block text-sm font-medium text-muted">การแสดงผล</span>
              <div className="mt-2 space-y-2">
                {DISPLAY_MODES.map((mode) => (
                  <label
                    key={mode}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors',
                      displayMode === mode
                        ? 'border-accent-strong/40 bg-accent-sunken/60'
                        : 'border-border hover:border-border-strong',
                    )}
                  >
                    <input
                      type="radio"
                      name="display-mode"
                      className="mt-0.5"
                      aria-label={DISPLAY_MODE_LABEL[mode]}
                      checked={displayMode === mode}
                      onChange={() => setDisplayMode(mode)}
                    />
                    <span className="flex-1">
                      <span className="block text-sm font-bold text-ink">{DISPLAY_MODE_LABEL[mode]}</span>
                      <span className="block text-[11px] text-muted">
                        {mode === 'ALWAYS'
                          ? 'เมื่อบันทึกและซิงค์ เมนูจะกลับมาเป็นเมนูหลักทันที'
                          : mode === 'SCHEDULED'
                            ? 'ระบบแสดง/ซ่อนเมนูอัตโนมัติตามช่วงเวลา'
                            : 'ซิงค์ไป LINE แต่ไม่ตั้งเป็นเมนูหลัก'}
                      </span>
                      {mode === 'SCHEDULED' && displayMode === 'SCHEDULED' && (
                        <span className="mt-3 block space-y-2">
                          <ThaiDateTimeField label="เริ่มแสดง" value={displayStartAt} onChange={setDisplayStartAt} />
                          <ThaiDateTimeField label="ซ่อนเมื่อถึง" value={displayEndAt} onChange={setDisplayEndAt} />
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-muted">รูปภาพเมนู</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="เปลี่ยนรูปเมนู"
              className="group relative mt-2 block w-full overflow-hidden rounded-xl border-2 border-dashed border-border bg-surface-sunken transition-colors hover:border-accent-strong/50"
              style={{ aspectRatio: `${size.width}/${size.height}` }}
            >
              {imagePreview ? (
                <span className="relative block h-full w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="ตัวอย่างรูปเมนู" className="h-full w-full object-cover" />
                  <span className="pointer-events-none absolute inset-0">
                    {areas.map((a, i) => (
                      <span
                        key={i}
                        className="absolute flex items-center justify-center border border-white/80 bg-black/20 text-2xl font-bold text-white"
                        style={areaStyle(a.bounds, size)}
                      >
                        {i + 1}
                      </span>
                    ))}
                  </span>
                </span>
              ) : (
                <span className="flex h-full flex-col items-center justify-center py-10 text-sm text-muted">
                  คลิกเพื่ออัปโหลดรูปภาพ
                </span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              aria-label="เลือกไฟล์รูปเมนู"
              className="hidden"
              onChange={handleImageChange}
            />
            <p className="mt-2 text-xs text-muted">รองรับ JPEG, PNG — สูงสุด 1 MB (ระบบย่อให้อัตโนมัติ)</p>
          </div>
        </div>

        {areas.length > 0 && (
          <div className="space-y-4 border-t border-border pt-4">
            <div>
              <h3 className="text-sm font-bold text-ink">Area Actions</h3>
              <p className="text-xs text-muted">กำหนดปลายทางของแต่ละพื้นที่บนเมนู</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {areas.map((area, i) => (
                <div key={i} className="space-y-3 rounded-xl border border-border bg-surface-sunken/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase text-muted">พื้นที่ {i + 1}</span>
                    <select
                      aria-label={`ประเภทการทำงานพื้นที่ ${i + 1}`}
                      value={area.action.type}
                      onChange={(e) => setAreaType(i, e.target.value as RichMenuArea['action']['type'])}
                      className="min-h-touch rounded-lg border border-border bg-surface px-2 text-xs"
                    >
                      <option value="uri">Open URL</option>
                      <option value="message">Send Msg</option>
                      <option value="richmenuswitch">สลับเมนู</option>
                    </select>
                  </div>

                  {area.action.type === 'uri' && (
                    <div>
                      <Label htmlFor={`rm-uri-${i}`}>WEBSITE URL</Label>
                      <Input
                        id={`rm-uri-${i}`}
                        value={area.action.uri ?? ''}
                        onChange={(e) => setAreaAction(i, { uri: e.target.value })}
                        placeholder="https://"
                      />
                    </div>
                  )}
                  {area.action.type === 'message' && (
                    <div>
                      <Label htmlFor={`rm-text-${i}`}>TEXT / PAYLOAD</Label>
                      <Input
                        id={`rm-text-${i}`}
                        value={area.action.text ?? ''}
                        onChange={(e) => setAreaAction(i, { text: e.target.value })}
                      />
                    </div>
                  )}
                  {area.action.type === 'richmenuswitch' && (
                    <div>
                      <Label htmlFor={`rm-alias-${i}`}>สลับไปที่เมนู (ALIAS)</Label>
                      {aliases.length === 0 ? (
                        <p className="text-[11px] text-warning-ink">
                          ยังไม่มี alias —{' '}
                          <Link href="/admin/chatbot/rich-menus/aliases" className="font-bold underline">
                            สร้าง alias ก่อน
                          </Link>
                        </p>
                      ) : (
                        <select
                          id={`rm-alias-${i}`}
                          aria-label={`alias ปลายทางพื้นที่ ${i + 1}`}
                          value={area.action.richMenuAliasId ?? ''}
                          onChange={(e) => setAreaAction(i, { richMenuAliasId: e.target.value })}
                          className="min-h-touch w-full rounded-lg border border-border bg-surface px-2 text-sm"
                        >
                          <option value="">-- เลือก alias --</option>
                          {aliases.map((a) => (
                            <option key={a.aliasId} value={a.aliasId}>
                              {a.aliasId}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
          <div className="mr-auto flex items-center gap-3">
            {action === 'sync' && (
              <Button variant="outline" size="sm" onClick={handleSyncAction} disabled={busy !== null}>
                Sync to LINE
              </Button>
            )}
            {action === 'resync' && (
              <Button variant="outline" size="sm" onClick={handleSyncAction} disabled={busy !== null}>
                {pendingResync ? 'ซิงค์การแก้ไข' : 'Re-sync'}
              </Button>
            )}
            {action === 'publish' && (
              <Button size="sm" onClick={handlePublishAction} disabled={busy !== null}>
                Set Active
              </Button>
            )}
            {action === null && (
              <span className="rounded-full border border-success/30 bg-success-soft px-3 py-1 text-[10px] font-black tracking-widest text-success-ink">
                Live Now
              </span>
            )}
          </div>
          <Link
            href="/admin/chatbot/rich-menus"
            className="inline-flex min-h-touch items-center rounded-md border border-border px-5 text-sm font-semibold text-ink hover:bg-accent-sunken"
          >
            ยกเลิก
          </Link>
          <Button variant="outline" onClick={() => handleSave(false)} disabled={busy !== null}>
            {busy === 'draft' ? 'กำลังบันทึก...' : 'บันทึกฉบับร่าง'}
          </Button>
          <Button onClick={() => handleSave(true)} disabled={busy !== null} className="gap-2">
            {busy === 'sync' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> กำลังบันทึกและซิงค์...
              </>
            ) : (
              'บันทึกและซิงค์'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
