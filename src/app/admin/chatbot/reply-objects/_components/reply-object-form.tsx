'use client';

import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError, Label, Input } from '@/components/ui/field';
import { REPLY_OBJECT_TYPES } from '@/lib/line/reply-object-validation';
import { findActionUriViolation, URI_SCHEME_ERROR_TH } from '@/lib/contracts';
import {
  defaultPayloadForType,
  ensureEditorKeys,
  safeParsePayload,
  stripEditorKeys,
  type QuickReply,
} from '../_lib/payload-utils';
import { QuickReplyEditor } from './quick-reply-editor';
import { MessagePreview } from './message-preview';

export interface ReplyObjectFormData {
  objectId: string;
  name: string;
  category: string;
  objectType: string;
  payload: string;
  altText: string;
}

export const EMPTY_REPLY_OBJECT_FORM: ReplyObjectFormData = {
  objectId: '',
  name: '',
  category: '',
  objectType: 'flex',
  payload: '{}',
  altText: '',
};

export function ReplyObjectForm({
  initial,
  lockObjectId,
  submitLabel,
  onSave,
  onCancel,
}: {
  initial: ReplyObjectFormData;
  lockObjectId: boolean;
  submitLabel: string;
  /** parent ยิง API เอง — คืน true เมื่อสำเร็จ */
  onSave: (data: ReplyObjectFormData) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ReplyObjectFormData>(() => ({
    ...initial,
    payload: (() => {
      try {
        const parsed: unknown = JSON.parse(initial.payload);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return JSON.stringify(ensureEditorKeys(parsed as Record<string, unknown>), null, 2);
        }
      } catch {}
      return initial.payload;
    })(),
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsedPayload = useMemo(() => safeParsePayload(form.payload), [form.payload]);

  const updatePayload = useCallback((next: Record<string, unknown>) => {
    setForm((prev) => ({ ...prev, payload: JSON.stringify(next, null, 2) }));
  }, []);

  const handleTypeChange = (newType: string) => {
    setForm((prev) => {
      const prevPayload = safeParsePayload(prev.payload);
      const next = defaultPayloadForType(newType);
      if (prevPayload.quickReply) next.quickReply = prevPayload.quickReply;
      return {
        ...prev,
        objectType: newType,
        payload: JSON.stringify(ensureEditorKeys(next), null, 2),
      };
    });
    setError(null);
  };

  const handleQuickReplyChange = (qr: QuickReply | undefined) => {
    const next: Record<string, unknown> = { ...parsedPayload };
    if (qr && Array.isArray(qr.items) && qr.items.length > 0) next.quickReply = qr;
    else delete next.quickReply;
    updatePayload(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.objectId.trim() || !form.name.trim()) {
      setError('กรุณากรอก Universal ID และ Internal Name');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(form.payload);
    } catch {
      setError('Invalid JSON payload');
      return;
    }
    const invalidUri = findActionUriViolation(parsed);
    if (invalidUri) {
      setError(`${URI_SCHEME_ERROR_TH} (${invalidUri})`);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const ok = await onSave({
        ...form,
        payload: JSON.stringify(stripEditorKeys(parsed)),
      });
      if (!ok) setSaving(false);
    } catch (err) {
      // § ห้ามกลืน exception — แสดงให้ผู้ใช้เห็นแทน return เงียบ
      console.error('[reply-object-form] onSave threw', err);
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ กรุณาลองใหม่');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ro-field-object-id" className="text-xs font-semibold uppercase tracking-wide text-muted">
            Universal ID *
          </Label>
          <Input
            id="ro-field-object-id"
            value={form.objectId}
            onChange={(e) => setForm({ ...form, objectId: e.target.value })}
            disabled={lockObjectId}
            className="font-mono font-bold"
            placeholder="flex_welcome"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ro-field-name" className="text-xs font-semibold uppercase tracking-wide text-muted">
            Internal Name *
          </Label>
          <Input
            id="ro-field-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="font-bold"
            placeholder="Welcome Message 2.0"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ro-field-object-type" className="text-xs font-semibold uppercase tracking-wide text-muted">
            Message Protocol *
          </Label>
          <select
            id="ro-field-object-type"
            value={form.objectType}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="min-h-touch w-full rounded-md border border-border bg-surface-raised px-4 text-sm font-bold text-ink"
          >
            {REPLY_OBJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ro-field-category" className="text-xs font-semibold uppercase tracking-wide text-muted">
            Grouping Category
          </Label>
          <Input
            id="ro-field-category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="font-bold"
            placeholder="Marketing / Support"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ro-field-alt-text" className="text-xs font-semibold uppercase tracking-wide text-muted">
          Alt Text (Mobile/Tablet accessibility)
        </Label>
        <Input
          id="ro-field-alt-text"
          value={form.altText}
          onChange={(e) => setForm({ ...form, altText: e.target.value })}
          className="font-bold"
          placeholder="Brief description of the message"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Label htmlFor="ro-field-payload" className="text-xs font-semibold uppercase tracking-wide text-muted">
            Content
          </Label>
          <textarea
            id="ro-field-payload"
            aria-label="Content"
            value={form.payload}
            onChange={(e) => setForm({ ...form, payload: e.target.value })}
            rows={12}
            spellCheck={false}
            className="w-full rounded-xl border border-border bg-[#0f172a] px-4 py-3 font-mono text-xs text-[#86efac] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong"
            placeholder="{ ... }"
            required
          />

          <p className="text-[11px] leading-relaxed text-muted">
            อ้างถึงในคำตอบด้วยรหัส เช่น <code className="font-mono">${form.objectId || 'object_id'}</code>{' '}
            (วางท้ายข้อความ คั่นด้วยเว้นวรรค) — หลีกเลี่ยงตัวเลขหลัง $ เช่น{' '}
            <code className="font-mono">$100</code> (จะหายไป)
          </p>

          <QuickReplyEditor
            value={parsedPayload.quickReply as QuickReply | undefined}
            onChange={handleQuickReplyChange}
          />
        </div>

        <div className="h-fit space-y-2 lg:sticky lg:top-0">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Live Preview</span>
          <div className="overflow-x-auto rounded-xl border border-border/60 bg-[#8aa6c8] p-4 dark:bg-[#39414d]">
            <MessagePreview
              objectType={form.objectType}
              payload={parsedPayload}
              altText={form.altText}
            />
          </div>
        </div>
      </div>

      <FieldError>{error}</FieldError>

      <div className="flex gap-3 pt-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'กำลังบันทึก…' : submitLabel}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}
