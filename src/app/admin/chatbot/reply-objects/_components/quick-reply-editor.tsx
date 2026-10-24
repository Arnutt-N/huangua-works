'use client';

import { Plus } from 'lucide-react';
import { LINE_QUICK_REPLY_MAX_ITEMS } from '@/lib/line/reply-object-validation';
import {
  FIELD_CLS,
  LABEL_CLS,
  getItemKey,
  makeEmptyAction,
  withNewKey,
  type QuickReply,
  type QuickReplyItem,
} from '../_lib/payload-utils';
import { ActionEditor } from './action-editor';

/**
 * QuickReplyEditor — modifier `payload.quickReply` ที่แนบได้กับทุก payload
 * เพดาน 13 ปุ่มตามโควตา LINE (LINE_QUICK_REPLY_MAX_ITEMS ตัวเดียวกับที่ server ตรวจ)
 */
export function QuickReplyEditor({
  value,
  onChange,
}: {
  value: QuickReply | undefined;
  onChange: (next: QuickReply | undefined) => void;
}) {
  const items = Array.isArray(value?.items) ? value.items : [];
  const enabled = items.length > 0;

  const setItems = (next: QuickReplyItem[]) =>
    onChange(next.length > 0 ? { items: next } : undefined);

  const updateItem = (i: number, patch: Partial<QuickReplyItem>) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => {
    if (items.length < LINE_QUICK_REPLY_MAX_ITEMS) {
      setItems([...items, withNewKey({ type: 'action', action: makeEmptyAction() })]);
    }
  };
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3 rounded-xl border border-border/60 p-4">
      <label className="flex cursor-pointer select-none items-center gap-2">
        <input
          type="checkbox"
          aria-label="Quick reply (ปุ่มลัดใต้ข้อความ)"
          checked={enabled}
          onChange={(e) =>
            e.target.checked
              ? setItems([withNewKey({ type: 'action', action: makeEmptyAction() })])
              : onChange(undefined)
          }
          className="h-4 w-4 accent-accent-strong"
        />
        <span className={LABEL_CLS}>Quick reply (ปุ่มลัดใต้ข้อความ)</span>
      </label>

      {enabled && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">
              {items.length}/{LINE_QUICK_REPLY_MAX_ITEMS} ปุ่ม
            </span>
            <button
              type="button"
              onClick={addItem}
              disabled={items.length >= LINE_QUICK_REPLY_MAX_ITEMS}
              className="inline-flex items-center gap-1 text-xs font-bold text-accent-strong disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> เพิ่มปุ่ม
            </button>
          </div>

          {items.map((item, i) => (
            <div key={getItemKey(item, i)} className="space-y-2">
              <ActionEditor
                action={item.action ?? makeEmptyAction()}
                onChange={(a) => updateItem(i, { action: a })}
                onRemove={items.length > 1 ? () => removeItem(i) : undefined}
                removeLabel={`ลบปุ่มลัดที่ ${i + 1}`}
              />
              <input
                className={FIELD_CLS}
                aria-label={`imageUrl ไอคอนปุ่มลัดที่ ${i + 1} (ไม่บังคับ)`}
                placeholder="imageUrl ไอคอนปุ่ม (ไม่บังคับ)"
                value={item.imageUrl ?? ''}
                onChange={(e) => updateItem(i, { imageUrl: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
