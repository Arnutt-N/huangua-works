'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { CannedResponse } from '../_lib/types';

/**
 * รายการข้อความสำเร็จรูป — popup เหนือ composer
 * เปิดด้วย "/" หรือปุ่ม toolbar; keyboard nav ↑↓ + Enter + Escape
 */
export function CannedPicker({
  items,
  filter,
  onPick,
  onClose,
}: {
  items: CannedResponse[];
  filter: string;
  onPick: (item: CannedResponse) => void;
  onClose: () => void;
}) {
  const [highlighted, setHighlighted] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const q = filter.trim().toLowerCase();
  const visible = q
    ? items.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.shortcut ?? '').toLowerCase().includes(q) ||
          c.content.toLowerCase().includes(q),
      )
    : items;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset highlight เมื่อ filter เปลี่ยน (sync กับ prop)
    setHighlighted(0);
  }, [q]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, visible.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
      } else if (e.key === 'Enter') {
        const item = visible[highlighted];
        if (item) {
          e.preventDefault();
          onPick(item);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [visible, highlighted, onPick, onClose]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${highlighted}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="ข้อความสำเร็จรูป"
      className="absolute bottom-full left-0 right-0 z-20 mb-2 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface-raised p-1.5 shadow-overlay"
    >
      {visible.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted">ไม่พบข้อความสำเร็จรูป</p>
      ) : (
        visible.map((item, i) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={i === highlighted}
            data-index={i}
            onMouseEnter={() => setHighlighted(i)}
            onClick={() => onPick(item)}
            className={cn(
              'flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left',
              i === highlighted ? 'bg-accent-sunken' : '',
            )}
          >
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink">{item.title}</span>
              {item.shortcut && (
                <span className="rounded-pill bg-surface-sunken px-1.5 py-0.5 text-[10px] font-mono text-muted">
                  /{item.shortcut}
                </span>
              )}
            </span>
            <span className="line-clamp-1 text-xs text-muted">{item.content}</span>
          </button>
        ))
      )}
    </div>
  );
}
