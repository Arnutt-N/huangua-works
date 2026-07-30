'use client';

import {
  ArrowLeft,
  ArrowRightLeft,
  Bot,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  User,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { MODE_LABELS } from '../_lib/labels';

export function ChatHeader({
  customerName,
  customerPicture,
  mode,
  panelOpen,
  onBack,
  onModeChange,
  onTransfer,
  onTogglePanel,
  onOpenPanelMobile,
}: {
  customerName: string | null;
  customerPicture: string | null;
  mode: string;
  panelOpen: boolean;
  onBack: () => void;
  onModeChange: (mode: string) => void;
  onTransfer: () => void;
  onTogglePanel: () => void;
  onOpenPanelMobile: () => void;
}) {
  const isBot = mode === 'bot_active';
  const isHuman = mode === 'human_active';

  return (
    <header className="h-14 flex-none border-b border-border bg-surface-raised/80 px-4 backdrop-blur-sm">
      <div className="flex h-full items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="กลับไปรายการสนทนา"
            className="inline-flex flex-none items-center justify-center rounded-md border border-border p-2 text-muted transition-colors duration-normal ease-out-expo hover:bg-surface-sunken hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong md:hidden"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          {customerPicture ? (
            // eslint-disable-next-line @next/next/no-img-element -- รูปโปรไฟล์ LINE เป็น external URL ไม่ fix โดเมน
            <img
              src={customerPicture}
              alt=""
              className="h-9 w-9 flex-none rounded-pill object-cover ring-2 ring-accent/20"
            />
          ) : (
            <span
              className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-pill bg-accent-sunken text-accent-strong ring-2 ring-accent/20"
              aria-hidden="true"
            >
              <UserRound className="h-5 w-5" />
            </span>
          )}

          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-bold text-ink">
              {customerName ?? 'ผู้ใช้ LINE'}
            </p>
            <span className="flex-none rounded-pill bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium text-muted">
              {MODE_LABELS[mode] ?? mode}
            </span>
          </div>
        </div>

        <div className="flex flex-none items-center gap-2">
          {/* สลับผู้ตอบ — บอท / เจ้าหน้าที่ (แทนปุ่ม "รับเรื่อง" เดิม เรียก handler เดียวกัน) */}
          {mode !== 'resolved' && (
            <div className="hidden items-center gap-0.5 rounded-pill bg-surface-sunken p-1 md:flex">
              <button
                type="button"
                onClick={() => onModeChange('bot_active')}
                aria-pressed={isBot}
                className={cn(
                  'inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-xs font-bold',
                  'transition-colors duration-normal ease-out-expo',
                  isBot
                    ? 'bg-accent-gradient text-on-accent shadow-sm'
                    : 'text-muted hover:text-ink',
                )}
              >
                <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                บอท
              </button>
              <button
                type="button"
                onClick={() => onModeChange('human_active')}
                aria-pressed={isHuman}
                className={cn(
                  'inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-xs font-bold',
                  'transition-colors duration-normal ease-out-expo',
                  isHuman
                    ? 'bg-accent-gradient text-on-accent shadow-sm'
                    : 'text-muted hover:text-ink',
                )}
              >
                <User className="h-3.5 w-3.5" aria-hidden="true" />
                เจ้าหน้าที่
              </button>
            </div>
          )}

          {isHuman && (
            <>
              <span className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
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
              'hidden items-center justify-center rounded-md border p-2 md:inline-flex',
              'transition-colors duration-normal ease-out-expo',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong',
              panelOpen
                ? 'border-accent/30 bg-accent-sunken text-accent-strong'
                : 'border-border bg-surface-raised text-muted hover:bg-surface-sunken hover:text-ink',
            )}
          >
            {panelOpen ? (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={onOpenPanelMobile}
            aria-label="แสดงข้อมูลลูกค้า"
            className="inline-flex items-center justify-center rounded-md border border-border p-2 text-muted transition-colors duration-normal ease-out-expo hover:bg-surface-sunken hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong md:hidden"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
