'use client';

import { MessagesSquare } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { cn } from '@/lib/cn';
import type { CannedResponse, Message } from '../_lib/types';
import { ChatHeader } from './chat-header';
import { Composer } from './composer';
import { MessageList } from './message-list';

export function ChatArea({
  selectedId,
  customerName,
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
    <div className={cn('min-w-0 flex-1 flex-col sm:flex', selectedId ? 'flex' : 'hidden')}>
      {!selectedId ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={MessagesSquare}
            title="เลือกการสนทนา"
            description="เลือกรายการจากด้านซ้ายเพื่อดูข้อความและตอบกลับผู้ใช้ LINE"
          />
        </div>
      ) : (
        <>
          <ChatHeader
            customerName={customerName}
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
            hasMore={hasMore}
            onLoadOlder={onLoadOlder}
            onRetry={onRetry}
          />
          <Composer
            canReply={canReply}
            ownershipBanner={ownershipBanner}
            actionError={actionError}
            cannedResponses={cannedResponses}
            onSend={onSend}
            onTakeover={onTakeover}
            onManageCanned={onManageCanned}
          />
        </>
      )}
    </div>
  );
}
