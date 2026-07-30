'use client';

import { MessagesSquare } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { CannedResponse, Message } from '../_lib/types';
import { ChatHeader } from './chat-header';
import { Composer } from './composer';
import { MessageList } from './message-list';

export function ChatArea({
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
      {!selectedId ? (
        <>
          <header className="flex h-14 flex-none items-center border-b border-border bg-surface-raised/80 px-4 backdrop-blur-sm">
            <span className="text-base font-bold text-ink">แชท LINE</span>
          </header>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <span
              className="inline-flex h-20 w-20 items-center justify-center rounded-lg border border-border bg-surface-raised shadow-lg"
              aria-hidden="true"
            >
              <MessagesSquare className="h-9 w-9 text-accent" />
            </span>
            <div className="space-y-1">
              <p className="text-base font-bold text-ink">เลือกการสนทนา</p>
              <p className="max-w-sm text-sm text-muted">
                เลือกรายการจากด้านซ้ายเพื่อดูข้อความและตอบกลับผู้ใช้ LINE
              </p>
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
