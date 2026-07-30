'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { CannedResponse } from '../_lib/types';
import { CannedPicker } from './canned-picker';

export function Composer({
  canReply,
  ownershipBanner,
  actionError,
  cannedResponses,
  onSend,
  onTakeover,
  onManageCanned,
}: {
  canReply: boolean;
  /** ห้อง human_active แต่คนดูแลเป็นแอดมินคนอื่น — โชว์ banner + ปุ่มรับช่วงต่อ */
  ownershipBanner: { ownerName: string | null } | null;
  actionError: string | null;
  cannedResponses: CannedResponse[];
  onSend: (text: string) => void;
  onTakeover: () => void;
  onManageCanned: () => void;
}) {
  const [input, setInput] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // auto-grow — สูงตามเนื้อหา สูงสุด ~6 บรรทัด
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [input]);

  // picker เปิดเมื่อ input ขึ้นต้นด้วย "/" — filter คือข้อความหลัง "/"
  const pickerFilter = input.startsWith('/') ? input.slice(1) : '';
  const showPicker = pickerOpen || (canReply && input.startsWith('/'));

  const handleSend = () => {
    const text = input.trim();
    if (!text || text.startsWith('/')) return;
    setInput('');
    onSend(text);
  };

  const handlePick = (item: CannedResponse) => {
    setInput(item.content);
    setPickerOpen(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="border-t border-border p-3">
      {ownershipBanner && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-warning-soft px-3 py-2">
          <p className="text-xs font-medium text-warning-ink">
            {ownershipBanner.ownerName
              ? `${ownershipBanner.ownerName} กำลังดูแลห้องนี้อยู่`
              : 'เจ้าหน้าที่ท่านอื่นกำลังดูแลห้องนี้อยู่'}
          </p>
          <Button type="button" size="sm" variant="outline" onClick={onTakeover}>
            รับช่วงต่อ
          </Button>
        </div>
      )}
      {actionError && (
        <p
          className="mb-2 rounded-md bg-danger-soft px-3 py-1.5 text-xs font-medium text-danger"
          role="alert"
        >
          {actionError}
        </p>
      )}
      <div className="relative">
        {showPicker && (
          <CannedPicker
            items={cannedResponses}
            filter={pickerFilter}
            onPick={handlePick}
            onClose={() => {
              setPickerOpen(false);
              if (input.startsWith('/')) setInput('');
            }}
          />
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => (showPicker ? setPickerOpen(false) : setPickerOpen(true))}
            disabled={!canReply}
            aria-label="ข้อความสำเร็จรูป"
            title='ข้อความสำเร็จรูป (พิมพ์ "/" ก็ได้)'
            onDoubleClick={onManageCanned}
            className={cn(
              'inline-flex min-h-touch min-w-touch flex-none items-center justify-center rounded-md text-muted',
              'hover:bg-accent-sunken hover:text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          >
            <Zap className="h-4 w-4" aria-hidden="true" />
          </button>
          <textarea
            ref={textareaRef}
            aria-label="พิมพ์ข้อความ"
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !showPicker) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              canReply ? 'พิมพ์ข้อความ... ("/" = ข้อความสำเร็จรูป)' : 'รับเรื่องก่อนเพื่อตอบผู้ใช้'
            }
            disabled={!canReply}
            className={cn(
              'min-h-touch flex-1 resize-none rounded-md border border-border bg-surface-raised px-4 py-2.5 text-sm text-ink placeholder:text-muted',
              'transition-colors duration-normal ease-out-expo',
              'focus:border-accent-strong focus:outline-none focus-visible:ring focus-visible:ring-accent-strong/35',
              'disabled:bg-surface-sunken disabled:opacity-50',
            )}
          />
          <Button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || input.startsWith('/') || !canReply}
            aria-label="ส่งข้อความ"
            className="flex-none px-4"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
