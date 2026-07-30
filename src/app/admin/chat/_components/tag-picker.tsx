'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Plus, Settings2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { createTag, fetchTags, putConversationTags } from '../_lib/api';
import { TAG_BADGE } from '../_lib/labels';
import type { ChatTag } from '../_lib/types';

/** สีที่เลือกได้ = token variant keys เท่านั้น (ตรงกับ TAG_COLORS ใน validation) */
const TAG_COLOR_OPTIONS = ['accent', 'gold', 'success', 'warning', 'danger', 'muted'] as const;

export function TagPicker({
  conversationId,
  selectedTags,
  onSaved,
}: {
  conversationId: string;
  selectedTags: ChatTag[];
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [allTags, setAllTags] = useState<ChatTag[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>('accent');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ปิดโหมดแก้ไขเฉพาะตอนเปลี่ยนห้อง — refetch ระหว่างแก้ต้องไม่ปิด panel กลางคัน
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reset UI state เมื่อเปลี่ยนห้อง */
    setEditing(false);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [conversationId]);

  // sync selection จาก server — เทียบเนื้อหา (ids) ไม่ใช่ array identity
  // กัน loadConversations (SSE ห้องอื่น) มา reset selection ทั้งที่ค่าเท่าเดิม
  const selectedKey = selectedTags.map((t) => t.id).join(',');
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync selection จาก prop เมื่อค่าจริงเปลี่ยน
    setSelectedIds(selectedKey ? selectedKey.split(',') : []);
  }, [conversationId, selectedKey]);

  useEffect(() => {
    if (!editing) return;
    void fetchTags().then(setAllTags);
  }, [editing]);

  const persist = useCallback(
    async (ids: string[]) => {
      setSelectedIds(ids);
      const ok = await putConversationTags(conversationId, ids);
      if (!ok) setError('บันทึกแท็กไม่สำเร็จ');
      onSaved();
    },
    [conversationId, onSaved],
  );

  const toggle = (tagId: string) => {
    setError(null);
    const next = selectedIds.includes(tagId)
      ? selectedIds.filter((id) => id !== tagId)
      : [...selectedIds, tagId];
    void persist(next);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    const result = await createTag({ name, color: newColor });
    setBusy(false);
    if (!result.ok || !result.tag) {
      setError(result.error ?? 'สร้างแท็กไม่สำเร็จ');
      return;
    }
    setNewName('');
    setAllTags((prev) => [...prev, result.tag as ChatTag]);
    void persist([...selectedIds, result.tag.id]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">แท็ก</h3>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-muted hover:bg-accent-sunken hover:text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong"
        >
          <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
          {editing ? 'เสร็จสิ้น' : 'จัดการแท็ก'}
        </button>
      </div>

      {!editing ? (
        selectedTags.length === 0 ? (
          <p className="text-xs text-muted">ยังไม่มีแท็ก</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {selectedTags.map((tag) => (
              <span
                key={tag.id}
                className={cn(
                  'rounded-pill px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                  TAG_BADGE[tag.color] ?? TAG_BADGE.muted,
                )}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="เลือกแท็ก">
            {allTags.map((tag) => {
              const active = selectedIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggle(tag.id)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                    'transition-colors duration-fast',
                    TAG_BADGE[tag.color] ?? TAG_BADGE.muted,
                    active ? 'ring-2' : 'opacity-60 hover:opacity-100',
                  )}
                >
                  {active && <Check className="h-3 w-3" aria-hidden="true" />}
                  {tag.name}
                </button>
              );
            })}
            {allTags.length === 0 && <p className="text-xs text-muted">ยังไม่มีแท็กในระบบ</p>}
          </div>

          <div className="space-y-1.5 rounded-md border border-border bg-surface-sunken/60 p-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
              placeholder="สร้างแท็กใหม่..."
              aria-label="ชื่อแท็กใหม่"
              className={cn(
                'h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-ink placeholder:text-muted',
                'focus:border-accent-strong focus:outline-none focus-visible:ring focus-visible:ring-accent-strong/35',
              )}
            />
            <div className="flex items-center gap-1.5">
              <div className="flex gap-1" role="radiogroup" aria-label="สีแท็ก">
                {TAG_COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={newColor === color}
                    aria-label={`สี ${color}`}
                    onClick={() => setNewColor(color)}
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-pill text-[10px] font-bold ring-1 ring-inset',
                      TAG_BADGE[color],
                      newColor === color && 'ring-2',
                    )}
                  >
                    {newColor === color ? <Check className="h-3 w-3" aria-hidden="true" /> : 'อ'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={!newName.trim() || busy}
                className={cn(
                  'ml-auto inline-flex h-7 items-center gap-1 rounded-md bg-accent-strong px-2 text-[11px] font-semibold text-on-accent',
                  'hover:opacity-90 disabled:pointer-events-none disabled:opacity-50',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong',
                )}
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                เพิ่ม
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="text-[11px] font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
