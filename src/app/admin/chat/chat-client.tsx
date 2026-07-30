'use client';

import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { fetchCannedResponses, fetchStaff, markConversationRead } from './_lib/api';
import type { CannedResponse, Message, SseChatEvent, StaffMember } from './_lib/types';
import { useChatSse } from './_hooks/use-chat-sse';
import { useConversations } from './_hooks/use-conversations';
import { useMessages } from './_hooks/use-messages';
import { useMessageSearch } from './_hooks/use-message-search';
import { CannedManageDialog } from './_components/canned-manage-dialog';
import { ChatArea } from './_components/chat-area';
import { ConversationList } from './_components/conversation-list';
import { CustomerPanel } from './_components/customer-panel';
import { TransferDialog } from './_components/transfer-dialog';

export function ChatClient({ adminUserId }: { adminUserId: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [cannedManageOpen, setCannedManageOpen] = useState(false);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);

  const {
    conversations,
    visible,
    counts,
    loading,
    filter,
    setFilter,
    sort,
    setSort,
    query,
    setQuery,
    loadConversations,
    togglePref,
    markReadLocal,
  } = useConversations();

  const {
    messages,
    detail,
    setDetail,
    selectedMode,
    setSelectedMode,
    actionError,
    hasMore,
    loadMessages,
    loadOlder,
    applyIncoming,
    send,
    retry,
    changeMode,
    transfer,
  } = useMessages(loadConversations);

  const { results: searchResults, searching } = useMessageSearch(query);

  const loadCanned = useCallback(() => {
    void fetchCannedResponses().then(setCannedResponses);
  }, []);

  useEffect(() => {
    loadCanned();
    void fetchStaff().then(setStaff);
  }, [loadCanned]);

  useChatSse({
    onOpen: () => {
      loadConversations();
      if (selectedId) loadMessages(selectedId);
    },
    onEvent: (event: SseChatEvent) => {
      if (event.type === 'new_message') {
        if (event.conversationId === selectedId) {
          applyIncoming(event.payload as unknown as Message);
          markConversationRead(selectedId);
        }
        loadConversations();
      }
      if (event.type === 'mode_change' || event.type === 'conversation_update') {
        loadConversations();
        if (event.conversationId === selectedId) {
          if (event.payload?.mode) setSelectedMode(event.payload.mode);
          // อัปเดตเจ้าของห้องทันที (โอนแชท/รับเรื่องจากเครื่องอื่น) — banner สลับถูกต้อง
          setDetail((prev) =>
            prev && prev.id === event.conversationId
              ? {
                  ...prev,
                  mode: event.payload?.mode ?? prev.mode,
                  assignedAdminId: event.payload?.assignedAdminId ?? prev.assignedAdminId,
                }
              : prev,
          );
        }
      }
    },
  });

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
      loadMessages(id);
      markConversationRead(id);
      markReadLocal(id);
    },
    [loadMessages, markReadLocal],
  );

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;
  const customerName = selectedConv?.displayName ?? null;

  // human_active แต่คนถือห้องเป็นแอดมินคนอื่น → โชว์ banner + ปิดช่องพิมพ์
  const ownedByOther =
    selectedMode === 'human_active' &&
    !!detail?.assignedAdminId &&
    detail.assignedAdminId !== adminUserId;
  const ownershipBanner = ownedByOther
    ? {
        ownerName:
          selectedConv?.assignedAdminName ??
          staff.find((s) => s.id === detail?.assignedAdminId)?.fullName ??
          null,
      }
    : null;

  const handleTakeover = useCallback(() => {
    if (selectedId) void transfer(selectedId, adminUserId);
  }, [selectedId, transfer, adminUserId]);

  const showPanel = panelOpen && !!selectedId && !!detail;

  return (
    <>
      <div className="flex h-dvh w-full overflow-hidden bg-surface font-sans">
        {/* มือถือ: แสดงรายการเต็มจอ แล้วสลับไปหน้าต่างแชทเมื่อเลือกห้อง */}
        <ConversationList
          visible={visible}
          counts={counts}
          loading={loading}
          filter={filter}
          setFilter={setFilter}
          sort={sort}
          setSort={setSort}
          query={query}
          setQuery={setQuery}
          searchResults={searchResults}
          searching={searching}
          selectedId={selectedId}
          onSelect={handleSelect}
          onTogglePin={(id, pinned) => togglePref(id, { pinned })}
          onToggleMute={(id, muted) => togglePref(id, { muted })}
          onMarkRead={(id) => {
            markConversationRead(id);
            markReadLocal(id);
          }}
        />
        <ChatArea
          selectedId={selectedId}
          customerName={customerName}
          customerPicture={selectedConv?.pictureUrl ?? null}
          mode={selectedMode}
          messages={messages}
          hasMore={hasMore}
          actionError={actionError}
          ownershipBanner={ownershipBanner}
          cannedResponses={cannedResponses}
          panelOpen={panelOpen}
          onBack={() => setSelectedId(null)}
          onModeChange={(mode) => selectedId && changeMode(selectedId, mode)}
          onSend={(text) => selectedId && send(selectedId, text)}
          onRetry={(msg) => selectedId && retry(selectedId, msg)}
          onLoadOlder={() => selectedId && loadOlder(selectedId)}
          onTakeover={handleTakeover}
          onTransfer={() => setTransferOpen(true)}
          onManageCanned={() => setCannedManageOpen(true)}
          onTogglePanel={() => setPanelOpen((v) => !v)}
          onOpenPanelMobile={() => setMobilePanelOpen(true)}
        />
        {/* คอลัมน์ขวา: ข้อมูลลูกค้า (desktop เท่านั้น — mobile ใช้ dialog) */}
        {showPanel && (
          <aside className="hidden w-72 flex-none border-l border-border bg-surface-raised md:block">
            <CustomerPanel
              conversation={selectedConv}
              detail={detail}
              staff={staff}
              onTagsSaved={loadConversations}
              onClose={() => setPanelOpen(false)}
            />
          </aside>
        )}
      </div>

      {/* mobile: ข้อมูลลูกค้าเป็น dialog */}
      <Dialog open={mobilePanelOpen} onOpenChange={setMobilePanelOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto p-0">
          <DialogTitle className="sr-only">ข้อมูลลูกค้า</DialogTitle>
          <CustomerPanel
            conversation={selectedConv}
            detail={detail}
            staff={staff}
            onTagsSaved={loadConversations}
          />
        </DialogContent>
      </Dialog>

      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        staff={staff}
        currentOwnerId={detail?.assignedAdminId ?? null}
        onConfirm={async (toAdminId, reason) => {
          if (!selectedId) return false;
          return transfer(selectedId, toAdminId, reason);
        }}
      />

      <CannedManageDialog
        open={cannedManageOpen}
        onOpenChange={setCannedManageOpen}
        items={cannedResponses}
        onChanged={loadCanned}
      />
    </>
  );
}
