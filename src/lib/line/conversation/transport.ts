import { getProfile, pushMessage, replyMessage, sendTypingIndicator } from '../client';
import type { LineOutgoingMessage, LineProfile } from '../types';

/**
 * port ไป LINE Messaging API — module บทสนทนาและ bot engine คุยกับ LINE ผ่าน interface นี้
 * adapter: httpLineTransport (prod) และ createRecordingTransport() (เทสต์ — recording-transport.ts)
 */
export interface LineTransport {
  reply(replyToken: string, messages: LineOutgoingMessage[]): Promise<void>;
  push(to: string, messages: LineOutgoingMessage[]): Promise<void>;
  /** best-effort — client.ts กลืน error เอง ไม่ล้ม flow ตอบข้อความ */
  showTyping(chatId: string): Promise<void>;
  getProfile(userId: string): Promise<LineProfile | null>;
}

export const httpLineTransport: LineTransport = {
  reply: replyMessage,
  push: pushMessage,
  showTyping: (chatId) => sendTypingIndicator(chatId),
  getProfile,
};
