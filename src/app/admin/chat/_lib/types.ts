export interface ChatTag {
  id: string;
  name: string;
  color: string;
}

/** prefix base64 ของ enc 8 ตัวอักษร — ใช้แสดงผลเท่านั้น ห้ามค้นหาหรือ join */
export type MaskedLineId = string | null;

export interface Conversation {
  id: string;
  mode: string;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  lastMessageSender: string | null;
  unreadAdmin: number;
  assignedAdminId: string | null;
  assignedAdminName?: string | null;
  linkedCaseId: string | null;
  displayName: string | null;
  pictureUrl?: string | null;
  lineUserId: MaskedLineId;
  pinned?: boolean;
  muted?: boolean;
  tags?: ChatTag[];
}

export interface ConversationDetail {
  id: string;
  mode: string;
  lineUserId: MaskedLineId;
  displayName: string | null;
  pictureUrl?: string | null;
  lastMessageAt: string | null;
  assignedAdminId: string | null;
  linkedCaseId: string | null;
  adminNote: string | null;
  adminNoteUpdatedAt: string | null;
  adminNoteUpdatedBy: string | null;
  unreadAdmin: number;
  createdAt: string;
}

export interface Message {
  id: string;
  sender: string;
  messageType: string;
  textContent: string | null;
  mediaUrl?: string | null;
  metadata?: { skipped?: string; fileName?: string; sizeBytes?: number; contentType?: string } | null;
  createdAt: string;
  clientTempId?: string | null;
  status?: 'pending' | 'failed';
}

export interface SseChatEvent {
  type?: string;
  conversationId?: string;
  payload?: { mode?: string; assignedAdminId?: string } & Record<string, unknown>;
}

export interface CannedResponse {
  id: string;
  title: string;
  shortcut: string | null;
  content: string;
  /** หมวดหมู่ (info/greeting/closing/escalation) — แถวเก่าก่อน migration อาจไม่มี */
  category?: string;
  usageCount?: number;
  isActive?: boolean;
  updatedAt?: string;
}

export interface StaffMember {
  id: string;
  fullName: string | null;
  role: string;
}

export interface MessageSearchResult {
  conversationId: string;
  messageId: string;
  snippet: string;
  sender: string;
  createdAt: string;
  displayName: string | null;
  lineUserId: MaskedLineId;
}

