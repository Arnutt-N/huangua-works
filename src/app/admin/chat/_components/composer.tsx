'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, Lock, Maximize2, Minimize2, Send, Zap } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { CannedResponse } from '../_lib/types';
import { CannedPicker } from './canned-picker';

const MAX_HEIGHT = 120;
const EXPANDED_MAX_HEIGHT = 240;

export function Composer({
  canReply,
  mode,
  ownershipBanner,
  actionError,
  cannedResponses,
  onSend,
  onTakeover,
  onManageCanned,
}: {
  canReply: boolean;
  mode: string;
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
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // auto-grow ในกรอบ 44–120px (กางแล้วสูงได้ถึง 240px)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, expanded ? EXPANDED_MAX_HEIGHT : MAX_HEIGHT)}px`;
  }, [input, expanded]);

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

  const canSubmit = !!input.trim() && !input.startsWith('/') && canReply;

  return (
    <footer className="relative flex-none border-t border-border bg-surface-raised">
      {ownershipBanner && (
        <div className="flex flex-wrap items-center justify-center gap-2 border-b border-warning-ink/20 bg-warning-soft px-3 py-1.5">
          <Lock className="h-3.5 w-3.5 flex-none text-warning-ink" aria-hidden="true" />
          <p className="text-xs font-semibold text-warning-ink">
            {ownershipBanner.ownerName
              ? `${ownershipBanner.ownerName} กำลังดูแลห้องนี้อยู่`
              : 'เจ้าหน้าที่ท่านอื่นกำลังดูแลห้องนี้อยู่'}
          </p>
          <button
            type="button"
            onClick={onTakeover}
            className="rounded-sm bg-warning-ink/15 px-2 py-0.5 text-xs font-semibold text-warning-ink transition-colors duration-normal ease-out-expo hover:bg-warning-ink/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-warning-ink"
          >
            รับช่วงต่อ
          </button>
        </div>
      )}
      {!canReply && !ownershipBanner && mode === 'bot_active' && (
        <div className="flex items-center justify-center gap-2 border-b border-accent-strong/20 bg-accent-sunken px-3 py-1.5">
          <Bot className="h-3.5 w-3.5 flex-none text-accent-strong" aria-hidden="true" />
          <p className="text-xs font-semibold text-accent-strong">Bot กำลังตอบอัตโนมัติ</p>
        </div>
      )}
      {actionError && (
        <p
          className="border-b border-danger/20 bg-danger-soft px-3 py-1.5 text-center text-xs font-medium text-danger"
          role="alert"
        >
          {actionError}
        </p>
      )}

      <div className="space-y-3 p-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => (showPicker ? setPickerOpen(false) : setPickerOpen(true))}
            disabled={!canReply}
            aria-label="ข้อความสำเร็จรูป"
            title='ข้อความสำเร็จรูป (พิมพ์ "/" ก็ได้)'
            onDoubleClick={onManageCanned}
            className={cn(
              'inline-flex items-center justify-center rounded-sm p-2',
              'transition-colors duration-normal ease-out-expo',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong',
              'disabled:pointer-events-none disabled:opacity-50',
              showPicker
                ? 'bg-accent-sunken text-accent-strong'
                : 'text-muted hover:bg-surface-sunken hover:text-ink',
            )}
          >
            <Zap className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

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
            <div className="relative min-w-0 flex-1">
              <textarea
                ref={textareaRef}
                aria-label="พิมพ์ข้อความ"
                value={input}
                rows={expanded ? 4 : 1}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !showPicker) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  canReply
                    ? 'พิมพ์ข้อความ... ("/" = ข้อความสำเร็จรูป)'
                    : 'รับเรื่องก่อนเพื่อตอบผู้ใช้'
                }
                disabled={!canReply}
                style={{ minHeight: '44px', maxHeight: `${expanded ? EXPANDED_MAX_HEIGHT : MAX_HEIGHT}px` }}
                className={cn(
                  'w-full resize-none rounded-md border border-border bg-surface px-4 py-3 pr-10 text-sm text-ink shadow-sm placeholder:text-muted',
                  'transition-colors duration-normal ease-out-expo',
                  'focus:border-accent focus:bg-surface-raised focus:outline-none focus-visible:ring focus-visible:ring-accent/40',
                  'disabled:bg-surface-sunken disabled:opacity-50',
                )}
              />
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? 'ย่อช่องพิมพ์' : 'ขยายช่องพิมพ์'}
                aria-pressed={expanded}
                className="absolute right-2 top-2 inline-flex items-center justify-center rounded-sm p-1.5 text-muted transition-colors duration-normal ease-out-expo hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong"
              >
                {expanded ? (
                  <Minimize2 className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Maximize2 className="h-3 w-3" aria-hidden="true" />
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSubmit}
              aria-label="ส่งข้อความ"
              className={cn(
                'inline-flex flex-none items-center justify-center rounded-md p-3 shadow-sm',
                'transition-shadow duration-normal ease-out-expo',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong',
                canSubmit
                  ? 'bg-accent-gradient text-on-accent hover:shadow-accent-glow active:scale-95'
                  : 'cursor-not-allowed bg-surface-sunken text-muted',
              )}
            >
              <Send className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
