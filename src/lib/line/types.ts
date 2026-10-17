export interface LineWebhookRequestBody {
  destination: string;
  events: LineWebhookEvent[];
}

export type LineWebhookEvent =
  | LineMessageEvent
  | LineFollowEvent
  | LineUnfollowEvent
  | LinePostbackEvent;

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
