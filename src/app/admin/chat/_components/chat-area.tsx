'use client';

import { MessagesSquare, PanelLeftOpen, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ConversationFilter } from '../_hooks/use-conversations';
import type { CannedResponse, Message } from '../_lib/types';
import { ChatHeader } from './chat-header';
import { Composer } from './composer';
import { MessageList } from './message-list';

export function ChatArea({
  connected,
  counts,
  listCollapsed,
  onToggleList,
  onQuickFilter,
  selectedId,
  customerName,
  customerPicture,
  mode,
  messages,
  hasMore,
  actionError,
  ownershipBanner,
  cannedResponses,
  panelOpen,
  onBack,
  onModeChange,
  onSend,
  onRetry,
  onLoadOlder,
  onTakeover,
  onTransfer,
  onManageCanned,
  onTogglePanel,
  onOpenPanelMobile,
}: {
  connected: boolean;
  counts: { all: number; waiting: number; active: number };
  listCollapsed: boolean;
  onToggleList: () => void;
  onQuickFilter: (filter: ConversationFilter) => void;
  selectedId: string | null;
  customerName: string | null;
  customerPicture: string | null;
  mode: string;
  messages: Message[];
  hasMore: boolean;
  actionError: string | null;
  ownershipBanner: { ownerName: string | null } | null;
  cannedResponses: CannedResponse[];
  panelOpen: boolean;
  onBack: () => void;
  onModeChange: (mode: string) => void;
  onSend: (text: string) => void;
  onRetry: (msg: Message) => void;
  onLoadOlder: () => void;
  onTakeover: () => void;
  onTransfer: () => void;
  onManageCanned: () => void;
  onTogglePanel: () => void;
  onOpenPanelMobile: () => void;
}) {
  // ตอบได้เมื่อรับเรื่องแล้วและเป็นคนดูแลเอง (banner = คนอื่นถืออยู่)
  const canReply = mode === 'human_active' && !ownershipBanner;

  return (
    <main className={cn('min-w-0 flex-1 flex-col bg-surface md:flex', selectedId ? 'flex' : 'hidden')}>
      <div className="flex h-10 flex-none items-center justify-between gap-3 border-b border-border bg-surface px-3">
        <div className="flex min-w-0 items-center gap-2">
          {listCollapsed && (
            <button
              type="button"
              onClick={onToggleList}
              aria-label="แสดงรายการสนทนา"
              title="แสดงรายการสนทนา"
              className="hidden items-center justify-center rounded-md p-1.5 text-muted hover:bg-surface-sunken hover:text-ink md:inline-flex"
            >
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <span className="truncate text-sm font-bold text-ink">Live Chat Console</span>
        </div>
        <span
          className={cn(
            'inline-flex flex-none items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset',
            connected
              ? 'bg-success-soft text-success-ink ring-success/30'
              : 'bg-surface-sunken text-muted ring-border',
          )}
        >
          {connected ? (
            <Wifi className="h-3 w-3" aria-hidden="true" />
          ) : (
            <WifiOff className="h-3 w-3" aria-hidden="true" />
          )}
          {connected ? 'Connected' : 'กำลังเชื่อมต่อ...'}
        </span>
      </div>

      {!selectedId ? (
        <>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <span
              className="inline-flex h-20 w-20 items-center justify-center rounded-lg border border-border bg-surface-raised shadow-lg"
              aria-hidden="true"
            >
              <MessagesSquare className="h-9 w-9 text-accent" />
            </span>
            <div className="space-y-1">
              <p className="text-base font-bold text-ink">Select a Conversation</p>
              <p className="max-w-sm text-sm text-muted">
                เลือกรายการจากด้านซ้ายเพื่อดูข้อความและตอบกลับผู้ใช้ LINE
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => onQuickFilter('waiting')}
                className="inline-flex items-center gap-1.5 rounded-pill border border-warning/40 bg-warning-soft px-3 py-1.5 text-xs font-semibold text-warning-ink hover:opacity-90"
              >
                Waiting
                <span className="rounded-pill bg-surface px-1.5 text-[10px] tabular-nums">{counts.waiting}</span>
              </button>
              <button
                type="button"
                onClick={() => onQuickFilter('active')}
                className="inline-flex items-center gap-1.5 rounded-pill border border-success/30 bg-success-soft px-3 py-1.5 text-xs font-semibold text-success-ink hover:opacity-90"
              >
                Active
                <span className="rounded-pill bg-surface px-1.5 text-[10px] tabular-nums">{counts.active}</span>
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <ChatHeader
            customerName={customerName}
            customerPicture={customerPicture}
            mode={mode}
            panelOpen={panelOpen}
            onBack={onBack}
            onModeChange={onModeChange}
            onTransfer={onTransfer}
            onTogglePanel={onTogglePanel}
            onOpenPanelMobile={onOpenPanelMobile}
          />
          <MessageList
            messages={messages}
            customerName={customerName}
            customerPicture={customerPicture}
            hasMore={hasMore}
            onLoadOlder={onLoadOlder}
            onRetry={onRetry}
          />
          <Composer
            canReply={canReply}
            mode={mode}
            ownershipBanner={ownershipBanner}
            actionError={actionError}
            cannedResponses={cannedResponses}
            onSend={onSend}
            onTakeover={onTakeover}
            onManageCanned={onManageCanned}
          />
        </>
      )}
    </main>
  );
}
