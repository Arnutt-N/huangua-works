'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, RefreshCw, Upload } from 'lucide-react';
import { adminApi, type RichMenuDisplayMode } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { Label, Input } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import {
  RICH_MENU_TEMPLATES,
  areaStyle,
  templateByKey,
  toLineAction,
  validateArea,
  type RichMenuArea,
  type RichMenuAreaAction,
} from '../rich-menu-templates';
import { ensureRichMenuImage } from '../rich-menu-image';
import { DISPLAY_MODE_LABEL } from '../rich-menu-state';
import { ThaiDateTimeField } from '../thai-datetime-field';

const DISPLAY_MODES: RichMenuDisplayMode[] = ['ALWAYS', 'SCHEDULED', 'MANUAL'];

export function RichMenuBuilderClient() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [chatBarText, setChatBarText] = useState('เมนูหลัก');
  const [templateKey, setTemplateKey] = useState(RICH_MENU_TEMPLATES[0]!.key);
  const [areas, setAreas] = useState<RichMenuArea[]>(() =>
    structuredClone(templateByKey(RICH_MENU_TEMPLATES[0]!.key).areas),
  );
  const [file, setFile] = useState<File | null>(null);
  const [displayMode, setDisplayMode] = useState<RichMenuDisplayMode>('ALWAYS');
  const [displayStartAt, setDisplayStartAt] = useState<string | null>(null);
  const [displayEndAt, setDisplayEndAt] = useState<string | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [pendingKey, setPendingKey] = useState(templateKey);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'draft' | 'sync' | null>(null);

  const template = templateByKey(templateKey);

  const replyObjectsRes = useResource({ load: adminApi.listReplyObjects });
  const intentsRes = useResource({ load: adminApi.listIntents });
  const aliasesRes = useResource({ load: adminApi.listMenuAliases });
  const replyObjects = replyObjectsRes.data?.items ?? [];
  const intents = intentsRes.data?.items ?? [];
  const aliases = aliasesRes.data?.items ?? [];

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function pickTemplate(key: string) {
    setTemplateKey(key);
    setAreas(structuredClone(templateByKey(key).areas));
    setPendingKey(key);
    setError(null);
  }

  function setAreaAction(index: number, patch: Partial<RichMenuAreaAction>) {
    setAreas((prev) =>
      prev.map((a, i) => (i === index ? { ...a, action: { ...a.action, ...patch } } : a)),
    );
  }

  function setAreaType(index: number, type: RichMenuAreaAction['type']) {
    setAreas((prev) =>
      prev.map((a, i) =>
        i === index ? { ...a, action: { type, uri: '', text: '', richMenuAliasId: '' } } : a,
      ),
    );
  }

  function quickSelectSystemObject(index: number, value: string) {
    if (value.startsWith('intent:')) {
      setAreaAction(index, { type: 'message', text: value.slice('intent:'.length) });
    } else if (value.startsWith('obj:')) {
      setAreaAction(index, { type: 'message', text: `get_obj:${value.slice('obj:'.length)}` });
    }
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

  async function handleSave(andSync: boolean) {
    const problem = validateAll();
    if (problem) {
      setError(problem);
      return;
    }
    if (andSync && !file) {
      setError('กรุณาเลือกรูปเมนูก่อนบันทึกและซิงค์');
      return;
    }

    setBusy(andSync ? 'sync' : 'draft');
    setError(null);

    const created = await adminApi.createRichMenu({
      name: name.trim(),
      chatBarText: chatBarText.trim() || 'เมนูหลัก',
      displayMode,
      ...(displayMode === 'SCHEDULED' && displayStartAt && displayEndAt
        ? { displayStartAt, displayEndAt }
        : {}),
      config: {
        size: template.size,
        selected: displayMode === 'ALWAYS',
        name: name.trim(),
        chatBarText: chatBarText.trim() || 'เมนูหลัก',
        areas: areas.map((a) => ({ bounds: a.bounds, action: toLineAction(a.action) })),
      },
    });
    if (!created.ok) {
      setBusy(null);
      setError(created.error);
      return;
    }
    const id = created.data.id;
    if (!id) {
      setBusy(null);
      setError('สร้างเมนูสำเร็จแต่ไม่ได้รับ id — ตรวจสอบที่หน้ารายการ');
      return;
    }
    if (!andSync) {
      setBusy(null);
      router.push('/admin/chatbot/rich-menus');
      return;
    }

    const synced = await adminApi.syncRichMenu(id);
    if (!synced.ok) {
      setBusy(null);
      setError(`สร้างเมนูแล้ว แต่ซิงค์ไม่สำเร็จ: ${synced.error}`);
      return;
    }

    try {
      const fitted = await ensureRichMenuImage(file!);
      const uploadFile =
        fitted.file instanceof File && !fitted.converted
          ? fitted.file
          : new File([fitted.file], fitted.filename, { type: 'image/jpeg' });
      const uploaded = await adminApi.uploadRichMenuImage(id, uploadFile);
      if (!uploaded.ok) {
        setBusy(null);
        setError(`ซิงค์แล้ว แต่อัปรูปไม่สำเร็จ: ${uploaded.error}`);
        return;
      }
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : 'รูปไม่พร้อมอัปโหลด');
      return;
    }

    if (displayMode === 'ALWAYS') {
      const published = await adminApi.publishRichMenu(id);
      if (!published.ok) {
        setBusy(null);
        setError(`ซิงค์และอัปรูปแล้ว แต่ตั้งเป็นเมนูหลักไม่สำเร็จ: ${published.error}`);
        return;
      }
    }

    setBusy(null);
    router.push('/admin/chatbot/rich-menus');
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader title="New Rich Menu">
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-sunken text-xs font-bold text-accent-strong">1</span>
              Basic Information
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="rb-name">Internal Name</Label>
                <Input
                  id="rb-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Summer Campaign 2024"
                />
              </div>
              <div>
                <Label htmlFor="rb-bar">Chat Bar Text</Label>
                <Input
                  id="rb-bar"
                  value={chatBarText}
                  onChange={(e) => setChatBarText(e.target.value)}
                  placeholder="เมนูหลัก"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-sunken text-xs font-bold text-accent-strong">2</span>
                Template &amp; Actions
              </h2>
              <button
                type="button"
                onClick={() => setTemplateModalOpen(true)}
                className="inline-flex items-center gap-1 text-sm font-bold text-accent-strong hover:underline"
              >
                <RefreshCw className="h-4 w-4" /> Change Template
              </button>
            </div>

            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-accent-strong/20 bg-accent-sunken/60 p-4">
              <div
                className="relative w-24 shrink-0 overflow-hidden rounded border border-border bg-surface"
                style={{ aspectRatio: `${template.size.width}/${template.size.height}` }}
              >
                {areas.map((a, i) => (
                  <span
                    key={i}
                    className="absolute border border-accent-strong/40"
                    style={areaStyle(a.bounds, template.size)}
                  />
                ))}
              </div>
              <div>
                <p className="text-lg font-bold text-accent-strong">{template.label}</p>
                <p className="text-xs text-muted">
                  {template.group} · {template.size.width}x{template.size.height}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {areas.map((area, i) => {
                const action = area.action;
                return (
                  <div key={i} className="space-y-3 rounded-2xl border border-border bg-surface-sunken/40 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-xs font-bold uppercase text-muted">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface text-[10px] font-bold text-ink">
                          {i + 1}
                        </span>
                        {area.label}
                      </span>
                      <select
                        aria-label={`ประเภทการทำงานพื้นที่ ${i + 1}`}
                        value={action.type}
                        onChange={(e) => setAreaType(i, e.target.value as RichMenuAreaAction['type'])}
                        className="min-h-touch rounded-lg border border-border bg-surface px-2 text-xs"
                      >
                        <option value="uri">Open URL</option>
                        <option value="message">Send Msg</option>
                        <option value="richmenuswitch">สลับเมนู</option>
                      </select>
                    </div>

                    {action.type === 'uri' && (
                      <div>
                        <Label htmlFor={`rb-uri-${i}`}>WEBSITE URL</Label>
                        <Input
                          id={`rb-uri-${i}`}
                          value={action.uri ?? ''}
                          onChange={(e) => setAreaAction(i, { uri: e.target.value })}
                          placeholder="https://"
                        />
                      </div>
                    )}

                    {action.type === 'message' && (
                      <div className="space-y-2">
                        <div>
                          <Label htmlFor={`rb-text-${i}`}>TEXT / PAYLOAD</Label>
                          <Input
                            id={`rb-text-${i}`}
                            value={action.text ?? ''}
                            onChange={(e) => setAreaAction(i, { text: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`rb-obj-${i}`}>SYSTEM OBJECTS</Label>
                          <select
                            id={`rb-obj-${i}`}
                            aria-label={`เลือก reply object หรือ intent พื้นที่ ${i + 1}`}
                            value=""
                            onChange={(e) => quickSelectSystemObject(i, e.target.value)}
                            className="min-h-touch w-full rounded-lg border border-border bg-surface px-2 text-sm"
                          >
                            <option value="">-- Quick Select --</option>
                            <optgroup label="Auto Replies">
                              {intents.map((intent) => (
                                <option key={intent.id} value={`intent:${intent.name}`}>
                                  {intent.name}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Reply Objects">
                              {replyObjects.map((obj) => (
                                <option key={obj.id} value={`obj:${obj.objectId}`}>
                                  {obj.name ?? obj.objectId}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                      </div>
                    )}

                    {action.type === 'richmenuswitch' && (
                      <div>
                        <Label htmlFor={`rb-alias-${i}`}>สลับไปที่เมนู (ALIAS)</Label>
                        {aliases.length === 0 ? (
                          <p className="text-[11px] text-warning-ink">
                            ยังไม่มี alias —{' '}
                            <Link href="/admin/chatbot/rich-menus/aliases" className="font-bold underline">
                              สร้าง alias ก่อน
                            </Link>
                          </p>
                        ) : (
                          <select
                            id={`rb-alias-${i}`}
                            aria-label={`alias ปลายทางพื้นที่ ${i + 1}`}
                            value={action.richMenuAliasId ?? ''}
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
                );
              })}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="sticky top-6 space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-sunken text-xs font-bold text-accent-strong">3</span>
              Design &amp; Sync
            </h2>

            <label
              className="group relative block cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-border bg-surface-sunken transition-colors hover:border-accent-strong/50"
              style={{ aspectRatio: `${template.size.width}/${template.size.height}` }}
            >
              {file && previewUrl ? (
                <span className="relative block h-full w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="ตัวอย่างรูปเมนู" className="h-full w-full object-cover" />
                  <span className="pointer-events-none absolute inset-0 opacity-50">
                    {areas.map((a, i) => (
                      <span
                        key={i}
                        className="absolute flex items-center justify-center border border-white bg-black/20 text-3xl font-bold text-white"
                        style={areaStyle(a.bounds, template.size)}
                      >
                        {i + 1}
                      </span>
                    ))}
                  </span>
                </span>
              ) : (
                <span className="flex h-full flex-col items-center justify-center gap-2 py-10 text-muted">
                  <Upload className="h-8 w-8 text-accent-strong" />
                  <span className="text-sm font-bold">Upload Rich Menu Image</span>
                  <span className="text-[10px]">
                    {template.size.width}x{template.size.height} pixels
                  </span>
                </span>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg"
                aria-label="เลือกรูปเมนู"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning-soft p-3">
              <p className="text-[11px] leading-normal text-warning-ink">
                รูปต้องตรงขนาดเทมเพลตที่เลือก ขนาดไม่เกิน 1 MB — ระบบจะย่อให้อัตโนมัติหากเกิน
              </p>
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-bold uppercase tracking-wider text-muted">การแสดงผล</span>
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
                        ? 'เมื่อบันทึกและซิงค์ เมนูจะถูกตั้งเป็นเมนูหลักทันที'
                        : mode === 'SCHEDULED'
                          ? 'ระบบแสดง/ซ่อนเมนูอัตโนมัติตามช่วงเวลาที่กำหนด'
                          : 'ซิงค์ไป LINE แต่ไม่ตั้งเป็นเมนูหลัก — ใช้กับ alias หรือผูก รายคน'}
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

            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={busy !== null}
                className="w-full"
              >
                {busy === 'draft' ? 'กำลังบันทึก...' : 'บันทึกฉบับร่าง'}
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={busy !== null}
                className="w-full gap-2"
              >
                {busy === 'sync' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> กำลังบันทึกและซิงค์...
                  </>
                ) : (
                  <>บันทึกและซิงค์ →</>
                )}
              </Button>
            </div>
          </section>
        </div>
      </div>

      {templateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="ปิดเลือกเทมเพลต"
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            onClick={() => setTemplateModalOpen(false)}
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-overlay">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-ink">Select a template</h2>
                <p className="text-sm text-muted">Choose a layout that fits your content strategy</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setTemplateModalOpen(false)}>
                ปิด
              </Button>
            </div>

            <div className="flex-1 space-y-8 overflow-y-auto p-6">
              {(['Large', 'Compact'] as const).map((group) => (
                <div key={group} className="space-y-4">
                  <div className="flex items-baseline gap-3">
                    <h3 className="text-xl font-bold text-ink">{group}</h3>
                    <span className="text-xs font-bold uppercase tracking-widest text-muted">
                      {RICH_MENU_TEMPLATES.find((t) => t.group === group)?.size.width}x
                      {RICH_MENU_TEMPLATES.find((t) => t.group === group)?.size.height}
                    </span>
                    <div className="h-px flex-grow bg-border" />
                  </div>
                  <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
                    {RICH_MENU_TEMPLATES.filter((t) => t.group === group).map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setPendingKey(t.key)}
                        className="space-y-2 text-center"
                      >
                        <div
                          className={cn(
                            'relative w-full overflow-hidden rounded border-2 transition-colors',
                            pendingKey === t.key
                              ? 'border-accent-strong bg-accent-sunken'
                              : 'border-border bg-surface-sunken hover:border-border-strong',
                          )}
                          style={{ aspectRatio: `${t.size.width}/${t.size.height}` }}
                        >
                          {t.areas.map((a, i) => (
                            <span
                              key={i}
                              className="absolute border border-border-strong/50"
                              style={areaStyle(a.bounds, t.size)}
                            />
                          ))}
                        </div>
                        <span
                          className={cn(
                            'block text-[11px] font-bold uppercase tracking-tight',
                            pendingKey === t.key ? 'text-accent-strong' : 'text-muted',
                          )}
                        >
                          {t.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 border-t border-border p-5">
              <Button variant="ghost" onClick={() => setTemplateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  pickTemplate(pendingKey);
                  setTemplateModalOpen(false);
                }}
              >
                Apply Design
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
