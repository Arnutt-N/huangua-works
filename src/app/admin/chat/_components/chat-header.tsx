'use client';

import { ArrowRightLeft, Bot, CheckCircle, ChevronLeft, Info, PanelRight, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { FALLBACK_BADGE, MODE_BADGE, MODE_LABELS } from '../_lib/labels';

export function ChatHeader({
  customerName,
  mode,
  panelOpen,
  onBack,
  onModeChange,
  onTransfer,
  onTogglePanel,
  onOpenPanelMobile,
}: {
  customerName: string | null;
  mode: string;
  panelOpen: boolean;
  onBack: () => void;
  onModeChange: (mode: string) => void;
  onTransfer: () => void;
  onTogglePanel: () => void;
  onOpenPanelMobile: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-sunken/60 px-4 py-2.5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-touch items-center gap-1 text-sm font-medium text-muted hover:text-accent-strong sm:hidden"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        รายการ
      </button>
      <div className="flex min-w-0 items-center gap-2">
        {customerName && (
          <span className="hidden max-w-40 truncate text-sm font-bold text-ink sm:block">
            {customerName}
          </span>
        )}
        <span
          className={cn(
            'rounded-pill px-3 py-1 text-xs font-semibold ring-1 ring-inset',
            MODE_BADGE[mode] ?? FALLBACK_BADGE,
          )}
        >
          {MODE_LABELS[mode] ?? mode}
        </span>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {mode !== 'human_active' && mode !== 'resolved' && (
          <Button type="button" size="sm" onClick={() => onModeChange('human_active')}>
            <UserCheck className="h-4 w-4" aria-hidden="true" />
            รับเรื่อง
          </Button>
        )}
        {mode === 'human_active' && (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onTransfer}
              title="โอนแชทให้เจ้าหน้าที่ท่านอื่น"
            >
              <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
              โอนแชท
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onModeChange('resolved')}
            >
              <CheckCircle className="h-4 w-4" aria-hidden="true" />
              ปิดเรื่อง
            </Button>
          </>
        )}
        {mode === 'resolved' && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onModeChange('bot_active')}
          >
            <Bot className="h-4 w-4" aria-hidden="true" />
            คืนให้ Bot
          </Button>
        )}
        {/* toggle panel — desktop พับ/กาง aside, mobile เปิดเป็น dialog */}
        <button
          type="button"
          onClick={onTogglePanel}
          aria-label={panelOpen ? 'ซ่อนข้อมูลลูกค้า' : 'แสดงข้อมูลลูกค้า'}
          aria-pressed={panelOpen}
          className={cn(
            'hidden h-9 w-9 items-center justify-center rounded-md lg:inline-flex',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong',
            panelOpen
              ? 'bg-accent-sunken text-accent-strong'
              : 'text-muted hover:bg-accent-sunken hover:text-accent-strong',
          )}
        >
          <PanelRight className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onOpenPanelMobile}
          aria-label="แสดงข้อมูลลูกค้า"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-accent-sunken hover:text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong lg:hidden"
        >
          <Info className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
