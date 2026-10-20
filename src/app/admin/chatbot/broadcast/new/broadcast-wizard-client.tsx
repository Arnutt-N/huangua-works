'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { AdminCard } from '@/components/admin/admin-card';
import { Button } from '@/components/ui/button';
import { FieldHint, Label, Textarea } from '@/components/ui/field';
import { ArrowLeft, ArrowRight, Check, FileText, Image, Braces, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/cn';

type ContentType = 'text' | 'image' | 'flex' | 'object';

const TYPE_CARDS: { key: ContentType; label: string; desc: string; icon: typeof FileText }[] = [
  { key: 'text', label: 'ข้อความ', desc: 'ส่งข้อความตัวอักษรธรรมดา', icon: FileText },
  { key: 'image', label: 'รูปภาพ', desc: 'ส่งรูปภาพพร้อม URL', icon: Image },
  { key: 'flex', label: 'Flex Message', desc: 'ส่ง Flex Message ด้วย JSON', icon: Braces },
  { key: 'object', label: 'Reply Object', desc: 'ใช้ template ที่มีอยู่แล้ว', icon: LayoutGrid },
];

const STEPS = ['เลือกประเภท', 'เขียนข้อความ', 'เลือกกลุ่มเป้าหมาย', 'ตรวจสอบและส่ง'];

export function BroadcastWizardClient() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [contentType, setContentType] = useState<ContentType>('text');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [flexJson, setFlexJson] = useState('{}');
  const [objectId, setObjectId] = useState('');
  const [targetKind, setTargetKind] = useState<'all' | 'specific'>('all');
  const [recipientOptions, setRecipientOptions] = useState<{ id: string; displayName: string | null }[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [scheduleAt, setScheduleAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadRecipients() {
    const res = await adminApi.listBroadcastRecipients();
    if (res.ok) setRecipientOptions(res.data.items);
  }

  function goStep(next: number) {
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

  function buildContent(): { content: { type: string; text?: string }[]; error: string | null } {
    if (contentType === 'text') {
      if (!message.trim()) return { content: [], error: 'กรุณากรอกข้อความ' };
      return { content: [{ type: 'text', text: message.trim() }], error: null };
    }
    if (contentType === 'image') {
      if (!imageUrl.trim()) return { content: [], error: 'กรุณากรอก URL รูปภาพ' };
      return { content: [{ type: 'text', text: imageUrl.trim() }], error: null };
    }
    if (contentType === 'flex') {
      try {
        JSON.parse(flexJson);
      } catch {
        return { content: [], error: 'Flex JSON ไม่ถูกต้อง' };
      }
      return { content: [{ type: 'text', text: flexJson.trim() }], error: null };
    }
    if (!objectId.trim()) return { content: [], error: 'กรุณากรอก Object ID' };
    return { content: [{ type: 'text', text: `$${objectId.trim()}` }], error: null };
  }

  async function handleCreate() {
    if (targetKind === 'specific' && selectedIds.length === 0) {
      setError('กรุณาเลือกผู้รับอย่างน้อย 1 คน');
      return;
    }
    const { content, error: contentError } = buildContent();
    if (contentError) {
      setError(contentError);
      return;
    }
    setSaving(true);
    setError(null);
    const res = await adminApi.createBroadcast({
      content,
      target: currentTarget(),
      scheduledAt: scheduleAt || null,
    });
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
          {contentType === 'text' && (
            <div>
              <Label htmlFor="bw-msg">ข้อความประกาศ</Label>
              <Textarea
                id="bw-msg"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="เช่น ประกาศ: อบต.หัวงัวปิดทำการวันที่ 12 ส.ค."
              />
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
          )}
          {contentType === 'object' && (
            <div>
              <Label htmlFor="bw-obj">Object ID (ไม่ต้องใส่ $)</Label>
              <input
                id="bw-obj"
                aria-label="Object ID (ไม่ต้องใส่ $)"
                value={objectId}
                onChange={(e) => setObjectId(e.target.value)}
                placeholder="เช่น welcome_flex"
                className="min-h-touch w-full rounded-md border border-border bg-surface-raised px-4 font-mono text-sm text-ink"
              />
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
          <div className="mt-4">
            <Label htmlFor="bw-schedule">ตั้งเวลาส่ง (เว้นว่าง = สร้างเป็นร่าง)</Label>
            <input
              id="bw-schedule"
              aria-label="ตั้งเวลาส่ง (เว้นว่าง = สร้างเป็นร่าง)"
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              className="min-h-touch w-full rounded-md border border-border bg-surface-raised px-4 text-ink"
            />
            <FieldHint>ระบบตรวจคิวทุก 30 นาที ประกาศอาจออกช้ากว่าเวลาที่ตั้ง</FieldHint>
          </div>
        </AdminCard>
      )}

      {step === 3 && (
        <AdminCard>
          <dl className="space-y-2 text-sm">
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
              <dd className="text-ink">{scheduleAt || 'สร้างเป็นร่าง (ส่งมือ)'}</dd>
            </div>
          </dl>
        </AdminCard>
      )}

      <div className="flex justify-between">
        <Button type="button" variant="outline" disabled={step === 0} onClick={() => goStep(step - 1)}>
          <ArrowLeft className="h-4 w-4" /> ย้อนกลับ
        </Button>
        {step < 3 ? (
          <Button type="button" onClick={() => goStep(step + 1)}>
            ถัดไป <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" onClick={handleCreate} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : scheduleAt ? 'ตั้งเวลาส่ง' : 'สร้างร่าง'}
          </Button>
        )}
      </div>
    </div>
  );
}
