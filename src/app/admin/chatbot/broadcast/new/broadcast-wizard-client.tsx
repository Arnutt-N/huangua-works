'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, type BroadcastContent } from '@/app/admin/_lib/admin-api';
import { AdminCard } from '@/components/admin/admin-card';
import { useConfirm } from '@/components/admin/use-confirm';
import { Button } from '@/components/ui/button';
import { FieldHint, Label, Textarea } from '@/components/ui/field';
import { ThaiDatePicker } from '@/components/ui/thai-date-picker';
import { ArrowLeft, ArrowRight, Check, FileText, Image, Braces, Send } from 'lucide-react';
import { cn } from '@/lib/cn';
import { BROADCAST_TEXT_MAX, BROADCAST_TITLE_MAX } from '@/lib/contracts';

// ponytail: ตัด type object ออกชั่วคราว — server ยังไม่มี resolver $objectId → LineOutgoingMessage
// คืนได้เมื่อ broadcast-service แกะ ref ก่อนยิง LINE API
type ContentType = 'text' | 'image' | 'flex';



const TYPE_CARDS: { key: ContentType; label: string; desc: string; icon: typeof FileText }[] = [
  { key: 'text', label: 'ข้อความ', desc: 'ส่งข้อความตัวอักษรธรรมดา', icon: FileText },
  { key: 'image', label: 'รูปภาพ', desc: 'ส่งรูปภาพพร้อม URL', icon: Image },
  { key: 'flex', label: 'Flex Message', desc: 'ส่ง Flex Message ด้วย JSON', icon: Braces },
];

const STEPS = ['เลือกประเภท', 'เขียนข้อความ', 'เลือกกลุ่มเป้าหมาย', 'ตรวจสอบและส่ง'];

export function BroadcastWizardClient() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [contentType, setContentType] = useState<ContentType>('text');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [flexJson, setFlexJson] = useState('{}');
  const [flexAltText, setFlexAltText] = useState('');
  const [targetKind, setTargetKind] = useState<'all' | 'specific'>('all');
  const [recipientOptions, setRecipientOptions] = useState<{ id: string; displayName: string | null }[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const scheduleAt =
    scheduleDate && scheduleTime ? `${scheduleDate}T${scheduleTime}` : '';

  async function loadRecipients() {
    const res = await adminApi.listBroadcastRecipients();
    if (res.ok) setRecipientOptions(res.data.items);
  }

  function goStep(next: number) {
    if (next > 1) {
      const { error: contentError } = buildContent();
      if (contentError) {
        setError(contentError);
        return;
      }
    }
    setError(null);
    if (next === 2 && recipientOptions.length === 0) void loadRecipients();
    setStep(next);
  }

  function currentTarget(): { kind: 'all' } | { kind: 'line_user_ids'; ids: string[] } {
    return targetKind === 'all' ? { kind: 'all' } : { kind: 'line_user_ids', ids: selectedIds };
  }

  async function refreshEstimate() {
    const res = await adminApi.dryRunBroadcast(currentTarget());
    setEstimate(res.ok ? res.data.estimatedRecipients : null);
  }

  function buildContent(): { content: BroadcastContent[]; error: string | null } {
    if (contentType === 'text') {
      if (!message.trim()) return { content: [], error: 'กรุณากรอกข้อความ' };
      if (message.length > BROADCAST_TEXT_MAX) {
        return { content: [], error: `ข้อความยาวเกิน ${BROADCAST_TEXT_MAX.toLocaleString('th-TH')} ตัวอักษร` };
      }
      return { content: [{ type: 'text', text: message.trim() }], error: null };
    }
    if (contentType === 'image') {
      const url = imageUrl.trim();
      if (!url) return { content: [], error: 'กรุณากรอก URL รูปภาพ' };
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return { content: [], error: 'URL รูปภาพต้องขึ้นต้นด้วย https://' };
      } catch {
        return { content: [], error: 'URL รูปภาพไม่ถูกต้อง' };
      }
      return { content: [{ type: 'image', originalContentUrl: url, previewImageUrl: url }], error: null };
    }
    let contents: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(flexJson);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return { content: [], error: 'Flex JSON ต้องเป็น object' };
      }
      contents = parsed as Record<string, unknown>;
    } catch {
      return { content: [], error: 'Flex JSON ไม่ถูกต้อง' };
    }
    // § altText มาจาก field ที่ผู้ใช้กรอกแยก ไม่เดาจาก text field แรก — JSON เปลี่ยนรูปได้ เดาเสี่ยงว่าง/ผิด
    const altText = flexAltText.trim();
    if (!altText) return { content: [], error: 'กรุณากรอกข้อความสำรอง (altText)' };
    return { content: [{ type: 'flex', altText, contents }], error: null };
  }

  async function handleCreate(mode: 'draft' | 'schedule' | 'send-now') {
    if (targetKind === 'specific' && selectedIds.length === 0) {
      setError('กรุณาเลือกผู้รับอย่างน้อย 1 คน');
      return;
    }
    const { content, error: contentError } = buildContent();
    if (contentError) {
      setError(contentError);
      return;
    }
    if (mode === 'send-now') {
      // § FORM-06: ใช้ useConfirm แทน window.confirm
      const ok = await confirm({
        title: 'ยืนยันการส่งประกาศทันที',
        description: 'ส่งทันที — จะยกเลิกเวลาที่ตั้งไว้ (ถ้ามี) แล้วส่งเลย ต้องการดำเนินการต่อหรือไม่?',
        confirmText: 'ส่งทันที',
      });
      if (!ok) return;
    }
    // § datetime-local เป็นเวลาท้องถิ่น — ตั้งอดีตผ่านจะค้าง scheduled ไม่ส่ง (cron ยิง <= NOW)
    // past-time guard ใช้เฉพาะ mode 'schedule' — draft/send-now ส่ง scheduledAt: null อยู่แล้ว
    if (mode === 'schedule') {
      if (!scheduleAt) {
        setError('กรุณาเลือกวันเวลา — หรือกด "บันทึกแบบร่าง" ถ้ายังไม่ต้องการตั้งเวลา');
        return;
      }
      if (new Date(scheduleAt).getTime() <= Date.now()) {
        setError('เวลาส่งต้องเป็นอนาคต — เลือกเวลาใหม่หรือเว้นว่างเพื่อสร้างเป็นร่าง');
        return;
      }
    }
    setSaving(true);
    setError(null);
    const res = await adminApi.createBroadcast({
      title: title.trim() || null,
      content,
      target: currentTarget(),
      status: mode === 'schedule' ? 'scheduled' : 'draft',
      scheduledAt: mode === 'schedule' ? new Date(scheduleAt).toISOString() : null,
    });
    if (res.ok && mode === 'send-now' && res.data.id) {
      const sent = await adminApi.sendBroadcast(res.data.id);
      if (!sent.ok) {
        setSaving(false);
        setError(`สร้างแล้วแต่ส่งไม่สำเร็จ: ${sent.error} — เปิดรายการแล้วกดส่งได้อีกครั้ง`);
        return;
      }
    }
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push('/admin/chatbot/broadcast');
  }

  return (
    <div className="space-y-4">
      <ol className="flex items-center gap-1 text-xs font-medium" aria-label="ขั้นตอนสร้างประกาศ">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-1">
            <span
              className={cn(
                'flex h-6 w-6 flex-none items-center justify-center rounded-full',
                i < step
                  ? 'bg-success/15 text-success'
                  : i === step
                    ? 'bg-accent-strong text-on-accent'
                    : 'bg-surface-sunken text-muted',
              )}
              aria-current={i === step ? 'step' : undefined}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn('hidden sm:inline', i === step ? 'text-ink' : 'text-muted')}>{label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px flex-1 bg-border" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {error && (
        <p role="status" className="rounded-lg bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      {step === 0 && (
        <AdminCard>
          <div className="grid gap-3 sm:grid-cols-2">
            {TYPE_CARDS.map((t) => {
              const Icon = t.icon;
              const active = contentType === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setContentType(t.key)}
                  aria-pressed={active}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-4 text-left',
                    active ? 'border-accent-strong bg-accent/5' : 'border-border/50 hover:bg-accent/5',
                  )}
                >
                  <Icon className="mt-0.5 h-5 w-5 flex-none text-accent-strong" />
                  <span>
                    <span className="block text-sm font-semibold text-ink">{t.label}</span>
                    <span className="block text-xs text-muted">{t.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </AdminCard>
      )}

      {step === 1 && (
        <AdminCard>
          <div className="mb-4">
            <Label htmlFor="bw-title">ชื่อแคมเปญ</Label>
            <input
              id="bw-title"
              aria-label="ชื่อแคมเปญ"
              maxLength={BROADCAST_TITLE_MAX}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น ประกาศปิดทำการวันที่ 12 ส.ค."
              className="min-h-touch w-full rounded-md border border-border bg-surface-raised px-4 text-ink"
            />
            <FieldHint>ชื่อที่ใช้แสดงในตาราง — ถ้าเว้นว่างจะใช้ข้อความประกาศแทน</FieldHint>
          </div>
          {contentType === 'text' && (
            <div>
              <Label htmlFor="bw-msg">ข้อความประกาศ</Label>
              <Textarea
                id="bw-msg"
                rows={4}
                maxLength={BROADCAST_TEXT_MAX}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="เช่น ประกาศ: อบต.หัวงัวปิดทำการวันที่ 12 ส.ค."
              />
              {/* § LINE จำกัดข้อความ broadcast ต่อครั้งที่ 5000 ตัวอักษร */}
              <p className="mt-1 text-right text-xs tabular-nums text-muted">
                {message.length.toLocaleString('th-TH')} / {BROADCAST_TEXT_MAX.toLocaleString('th-TH')}
              </p>
            </div>
          )}
          {contentType === 'image' && (
            <div>
              <Label htmlFor="bw-img">URL รูปภาพ (https)</Label>
              <input
                id="bw-img"
                aria-label="URL รูปภาพ (https)"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="min-h-touch w-full rounded-md border border-border bg-surface-raised px-4 text-ink"
              />
            </div>
          )}
          {contentType === 'flex' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="bw-flex">Flex JSON</Label>
                <Textarea
                  id="bw-flex"
                  rows={6}
                  value={flexJson}
                  onChange={(e) => setFlexJson(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label htmlFor="bw-alt">ข้อความสำรอง (altText)</Label>
                <input
                  id="bw-alt"
                  aria-label="ข้อความสำรอง (altText)"
                  value={flexAltText}
                  onChange={(e) => setFlexAltText(e.target.value)}
                  placeholder="เช่น ประกาศจาก อบต.หัวงัว"
                  className="min-h-touch w-full rounded-md border border-border bg-surface-raised px-4 text-ink"
                />
                <FieldHint>แสดงแทน Flex บนอุปกรณ์ที่ไม่รองรับ</FieldHint>
              </div>
            </div>
          )}
        </AdminCard>
      )}

      {step === 2 && (
        <AdminCard>
          <Label>กลุ่มผู้รับ</Label>
          <div className="mt-1 flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                aria-label="ผู้ติดตามทุกคน"
                name="bw-target"
                checked={targetKind === 'all'}
                onChange={() => {
                  setTargetKind('all');
                  setEstimate(null);
                }}
              />
              ผู้ติดตามทุกคน
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                aria-label="เลือกเฉพาะราย"
                name="bw-target"
                checked={targetKind === 'specific'}
                onChange={() => {
                  setTargetKind('specific');
                  setEstimate(null);
                }}
              />
              เลือกเฉพาะราย
            </label>
          </div>
          {targetKind === 'specific' && (
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {recipientOptions.length === 0 ? (
                <p className="text-sm text-muted">ยังไม่มีผู้ใช้ LINE ในระบบ</p>
              ) : (
                recipientOptions.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      aria-label={opt.displayName ?? opt.id}
                      checked={selectedIds.includes(opt.id)}
                      onChange={(e) => {
                        setEstimate(null);
                        setSelectedIds((prev) =>
                          e.target.checked ? [...prev, opt.id] : prev.filter((x) => x !== opt.id),
                        );
                      }}
                    />
                    {opt.displayName ?? '(ไม่มีชื่อ)'}
                  </label>
                ))
              )}
            </div>
          )}
          <div className="mt-2 flex items-center gap-3">
            <Button type="button" variant="outline" onClick={refreshEstimate}>
              ประเมินจำนวนผู้รับ
            </Button>
            {estimate !== null && <span className="text-sm text-muted">ประมาณ {estimate} คน</span>}
          </div>
          <div className="mt-4 space-y-3">
            <ThaiDatePicker
              id="bw-schedule-date"
              label="วันที่ส่ง (เว้นว่าง = สร้างเป็นร่าง)"
              value={scheduleDate}
              onChange={setScheduleDate}
              placeholder="เลือกวันที่"
            />
            <div>
              <Label htmlFor="bw-schedule-time">เวลาส่ง</Label>
              <input
                id="bw-schedule-time"
                aria-label="เวลาส่ง"
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                disabled={!scheduleDate}
                className="min-h-touch w-full rounded-md border border-border bg-surface-raised px-4 text-ink disabled:opacity-50"
              />
            </div>
            <FieldHint>ระบบตรวจคิวทุก 30 นาที ประกาศอาจออกช้ากว่าเวลาที่ตั้ง</FieldHint>
          </div>
        </AdminCard>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <AdminCard>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="w-28 flex-none text-muted">ชื่อแคมเปญ</dt>
                <dd className="text-ink">{title || '(ใช้ข้อความประกาศเป็นชื่อ)'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 flex-none text-muted">ประเภท</dt>
                <dd className="text-ink">{TYPE_CARDS.find((t) => t.key === contentType)?.label}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 flex-none text-muted">ผู้รับ</dt>
                <dd className="text-ink">
                  {targetKind === 'all'
                    ? 'ผู้ติดตามทุกคน'
                    : `เฉพาะราย ${selectedIds.length} คน`}
                  {estimate !== null && ` (ประมาณ ${estimate} คน)`}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 flex-none text-muted">กำหนดส่ง</dt>
                <dd className="text-ink">
                  {scheduleAt ? `${scheduleDate} ${scheduleTime}` : 'สร้างเป็นร่าง (ส่งมือ)'}
                </dd>
              </div>
            </dl>
          </AdminCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <AdminCard>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">ตัวอย่างเนื้อหา</p>
              {contentType === 'text' && (
                <p className="whitespace-pre-wrap text-sm text-ink">{message || '—'}</p>
              )}
              {contentType === 'image' && (
                <div className="space-y-1">
                  <p className="break-all font-mono text-xs text-ink">{imageUrl || '—'}</p>
                  {imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="ตัวอย่างรูปประกาศ" className="max-w-xs rounded-lg border border-border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                </div>
              )}
              {contentType === 'flex' && (
                <pre className="max-h-48 overflow-auto font-mono text-xs text-ink">{flexJson || '{}'}</pre>
              )}
            </AdminCard>

            <AdminCard>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">กลุ่มเป้าหมาย</p>
              <p className="text-sm text-ink">
                {targetKind === 'all' ? 'ผู้ติดตาม LINE OA ทุกคน' : `เลือกเฉพาะราย ${selectedIds.length} คน`}
              </p>
              {estimate !== null && (
                <p className="mt-1 text-xs text-muted">ประมาณ {estimate} คน</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={refreshEstimate}>
                  ประเมินจำนวนผู้รับ
                </Button>
                <span className="text-xs text-muted">ทดลองส่ง — นับผู้รับเท่านั้น ไม่ส่งจริง</span>
              </div>
            </AdminCard>
          </div>
        </div>
      )}

      <div className="flex justify-between gap-2">
        <Button type="button" variant="outline" disabled={step === 0} onClick={() => goStep(step - 1)}>
          <ArrowLeft className="h-4 w-4" /> ย้อนกลับ
        </Button>
        {step < 3 ? (
          <Button type="button" onClick={() => goStep(step + 1)}>
            ถัดไป <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void handleCreate('draft')} disabled={saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึกแบบร่าง'}
            </Button>
            <Button type="button" variant="outline" onClick={() => void handleCreate('schedule')} disabled={saving}>
              {saving ? 'กำลังบันทึก...' : 'ตั้งเวลาและบันทึก'}
            </Button>
            <Button type="button" onClick={() => void handleCreate('send-now')} disabled={saving} className="gap-1.5">
              <Send className="h-4 w-4" />
              {saving ? 'กำลังส่ง...' : 'ส่งเลย'}
            </Button>
          </div>
        )}
      </div>
      {confirmDialog}
    </div>
  );
}
