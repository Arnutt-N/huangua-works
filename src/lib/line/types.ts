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
  | { type: 'text'; text: string }
  | { type: 'image'; originalContentUrl: string; previewImageUrl: string }
  | { type: 'flex'; altText: string; contents: Record<string, unknown> }
  | { type: 'template'; altText: string; template: Record<string, unknown> };

export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}
