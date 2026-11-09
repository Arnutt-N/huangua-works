'use client';

import { useId } from 'react';
import { Trash2 } from 'lucide-react';
import { isAllowedActionUri, URI_SCHEME_ERROR_TH } from '@/lib/contracts';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select';
import { type LineAction } from '../_lib/payload-utils';

const ACTION_TYPES = ['message', 'uri', 'postback'] as const;

export function ActionEditor({
  action,
  onChange,
  onRemove,
  removeLabel,
}: {
  action: LineAction;
  onChange: (next: LineAction) => void;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const type = action.type ?? 'message';
  const set = (patch: Partial<LineAction>) => onChange({ ...action, ...patch });

  const uriErrorId = useId();
  const uriValue = action.uri ?? '';
  const hasInvalidUri = type === 'uri' && uriValue.trim() !== '' && !isAllowedActionUri(uriValue);

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-48 flex-1">
          <Input
            aria-label="ป้ายปุ่ม (label)"
            placeholder="ป้ายปุ่ม (label)"
            value={action.label ?? ''}
            onChange={(e) => set({ label: e.target.value })}
          />
        </span>
        <SelectField
          ariaLabel="ชนิด action"
          value={type}
          onValueChange={(next) => set({ type: next })}
          options={ACTION_TYPES.map((t) => ({ value: t, label: t }))}
          className="w-40 shrink-0"
        />
        {onRemove && (
          <IconButton type="button" intent="danger" onClick={onRemove} aria-label={removeLabel ?? 'ลบ action'}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        )}
      </div>

      {type === 'message' && (
        <Input
          aria-label="ข้อความที่จะส่ง (text)"
          placeholder="ข้อความที่จะส่ง (text)"
          value={action.text ?? ''}
          onChange={(e) => set({ text: e.target.value })}
        />
      )}
      {type === 'uri' && (
        <>
          <Input
            aria-label="ลิงก์ (uri)"
            placeholder="https://example.com"
            value={uriValue}
            aria-invalid={hasInvalidUri || undefined}
            aria-describedby={hasInvalidUri ? uriErrorId : undefined}
            onChange={(e) => set({ uri: e.target.value })}
          />
          {hasInvalidUri && (
            <p id={uriErrorId} role="alert" className="text-xs text-danger">
              {URI_SCHEME_ERROR_TH}
            </p>
          )}
        </>
      )}
      {type === 'postback' && (
        <>
          <Input
            aria-label="ข้อมูล postback (data)"
            placeholder="data (เช่น action=buy&id=1)"
            value={action.data ?? ''}
            onChange={(e) => set({ data: e.target.value })}
          />
          <Input
            aria-label="displayText (ไม่บังคับ)"
            placeholder="displayText (ไม่บังคับ)"
            value={action.displayText ?? ''}
            onChange={(e) => set({ displayText: e.target.value })}
          />
        </>
      )}
    </div>
  );
}
