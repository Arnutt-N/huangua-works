export interface LineWebhookRequestBody {
  destination: string;
  events: LineWebhookEvent[];
}

export type LineWebhookEvent =
  | LineMessageEvent
  | LineFollowEvent
  | LineUnfollowEvent
  | LinePostbackEvent;

export type ParsedWebhookEvent =
  | { kind: 'supported'; event: LineWebhookEvent }
  | { kind: 'ignored'; reason: string };

const SUPPORTED_TYPES = new Set(['message', 'follow', 'unfollow', 'postback']);
const MESSAGE_TYPES = new Set(['text', 'image', 'file', 'video', 'audio', 'location', 'sticker']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * § แปลง event จาก JSON (ขอบเขตภายนอก) ให้ domain type — event ที่บอทไม่รองรับ
 * ถูก acknowledge แทนที่จะปล่อยเข้า queue แล้ว insert พัง/check constraint ทำให้ทั้ง batch 500
 * § ต้องมี source.type='user' + userId จริง: engine/line_users ผูกกับ user id เท่านั้น
 * § timestamp เป็น Unix ms ต้องเป็น integer > 0 (bigint column รับได้ แต่ contract ต้องชัด)
 */
export function parseWebhookEvent(value: unknown): ParsedWebhookEvent {
  if (!isRecord(value)) return { kind: 'ignored', reason: 'not_object' };
  if (!SUPPORTED_TYPES.has(String(value.type))) return { kind: 'ignored', reason: 'unsupported_type' };
  const source = value.source;
  if (!isRecord(source) || source.type !== 'user') return { kind: 'ignored', reason: 'unsupported_source' };
  if (typeof source.userId !== 'string' || source.userId.length === 0) {
    return { kind: 'ignored', reason: 'missing_user_id' };
  }
  if (typeof value.timestamp !== 'number' || !Number.isInteger(value.timestamp) || value.timestamp <= 0) {
    return { kind: 'ignored', reason: 'invalid_timestamp' };
  }
  // § webhookEventId ถ้ามีต้องเป็น string เสมอ (message อาจไม่มี → ใช้ message.id เป็น fallback)
  // ค่าผิด type เช่น 42 ต้องไม่ผ่านเข้า dedupKeyOf ที่จะแปลงเป็น 'w:42' แล้วชนกับ redelivery ไม่ได้
  if (value.webhookEventId !== undefined && (
    typeof value.webhookEventId !== 'string' || value.webhookEventId.length === 0
  )) {
    return { kind: 'ignored', reason: 'invalid_webhook_event_id' };
  }
  if (value.type !== 'message' && typeof value.webhookEventId !== 'string') {
    return { kind: 'ignored', reason: 'missing_webhook_event_id' };
  }
  if (value.type === 'message') {
    if (!isRecord(value.message) || !MESSAGE_TYPES.has(String(value.message.type))) {
      return { kind: 'ignored', reason: 'invalid_message' };
    }
    // § ทุก message subtype ต้องมี id (dedup/link) และ field บังคับของตัวเอง — engine อ่านตรง ๆ
    if (typeof value.message.id !== 'string' || value.message.id.length === 0) {
      return { kind: 'ignored', reason: 'invalid_message' };
    }
    const msgType = String(value.message.type);
    const invalidMessageFields =
      (msgType === 'text' && typeof value.message.text !== 'string') ||
      (msgType === 'file' && (
        typeof value.message.fileName !== 'string' ||
        typeof value.message.fileSize !== 'number' || !Number.isFinite(value.message.fileSize)
      )) ||
      (msgType === 'location' && (
        typeof value.message.latitude !== 'number' || !Number.isFinite(value.message.latitude) ||
        typeof value.message.longitude !== 'number' || !Number.isFinite(value.message.longitude)
      )) ||
      (msgType === 'sticker' && (
        typeof value.message.packageId !== 'string' || typeof value.message.stickerId !== 'string'
      ));
    if (invalidMessageFields) return { kind: 'ignored', reason: 'invalid_message' };
  }
  if (value.type === 'postback') {
    if (!isRecord(value.postback) || typeof value.postback.data !== 'string') {
      return { kind: 'ignored', reason: 'invalid_postback' };
    }
  }
  return { kind: 'supported', event: value as unknown as LineWebhookEvent };
}


interface LineEventBase {
  type: string;
  replyToken: string;
  timestamp: number;
  mode: 'active' | 'standby';
  webhookEventId: string;
  deliveryContext?: { isRedelivery: boolean };
  source: {
    type: 'user' | 'group' | 'room';
    userId: string;
  };
}

export interface LineMessageEvent extends LineEventBase {
  type: 'message';
  message: LineIncomingMessage;
}

export type LineIncomingMessage =
  | { type: 'text'; id: string; text: string }
  | { type: 'image'; id: string }
  | { type: 'file'; id: string; fileName: string; fileSize: number }
  | { type: 'video'; id: string; duration?: number }
  | { type: 'audio'; id: string; duration?: number }
  | { type: 'location'; id: string; title?: string; address?: string; latitude: number; longitude: number }
  | { type: 'sticker'; id: string; packageId: string; stickerId: string };

export interface LineFollowEvent extends LineEventBase {
  type: 'follow';
}

export interface LineUnfollowEvent extends Omit<LineEventBase, 'replyToken'> {
  type: 'unfollow';
}

export interface LinePostbackEvent extends LineEventBase {
  type: 'postback';
  postback: {
    data: string;
    params?: Record<string, string>;
  };
}

export type LineOutgoingMessage =
  | { type: 'text'; text: string; quickReply?: LineQuickReply }
  | { type: 'image'; originalContentUrl: string; previewImageUrl: string; quickReply?: LineQuickReply }
  | { type: 'sticker'; packageId: string; stickerId: string; quickReply?: LineQuickReply }
  | { type: 'video'; originalContentUrl: string; previewImageUrl: string; quickReply?: LineQuickReply }
  | { type: 'audio'; originalContentUrl: string; duration: number; quickReply?: LineQuickReply }
  | { type: 'location'; title: string; address: string; latitude: number; longitude: number; quickReply?: LineQuickReply }
  | { type: 'imagemap'; baseUrl: string; altText: string; baseSize: { width: number; height: number }; actions: unknown[]; quickReply?: LineQuickReply }
  | { type: 'flex'; altText: string; contents: Record<string, unknown>; quickReply?: LineQuickReply }
  | { type: 'template'; altText: string; template: Record<string, unknown>; quickReply?: LineQuickReply };

export interface LineQuickReplyItem {
  type: 'action';
  action:
    | { type: 'message'; label: string; text: string }
    | { type: 'postback'; label: string; data: string; displayText?: string }
    | { type: 'uri'; label: string; uri: string };
}

export interface LineQuickReply {
  items: LineQuickReplyItem[];
}

export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}
