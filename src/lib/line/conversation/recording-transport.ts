import type { LineOutgoingMessage, LineProfile } from '../types';
import type { LineTransport } from './transport';

/** adapter in-memory สำหรับเทสต์ — บันทึกทุก call แทนการยิง LINE จริง */
export type TransportCall =
  | { kind: 'reply'; replyToken: string; messages: LineOutgoingMessage[] }
  | { kind: 'push'; to: string; messages: LineOutgoingMessage[] }
  | { kind: 'typing'; chatId: string }
  | { kind: 'profile'; userId: string };

export interface RecordingTransport extends LineTransport {
  readonly calls: readonly TransportCall[];
  /** ให้ push ครั้งถัดไป throw (จำลอง LINE ล่ม) — ครั้งเดียวแล้วกลับเป็นปกติ */
  failNextPush(error?: Error): void;
  setProfile(profile: LineProfile | null): void;
}

export function createRecordingTransport(): RecordingTransport {
  const calls: TransportCall[] = [];
  let pendingPushError: Error | null = null;
  let profile: LineProfile | null = null;

  return {
    get calls() {
      return calls;
    },
    failNextPush(error = new Error('push ล้มเหลว (จำลอง)')) {
      pendingPushError = error;
    },
    setProfile(next) {
      profile = next;
    },
    async reply(replyToken, messages) {
      calls.push({ kind: 'reply', replyToken, messages });
    },
    async push(to, messages) {
      calls.push({ kind: 'push', to, messages });
      if (pendingPushError) {
        const error = pendingPushError;
        pendingPushError = null;
        throw error;
      }
    },
    async showTyping(chatId) {
      calls.push({ kind: 'typing', chatId });
    },
    async getProfile(userId) {
      calls.push({ kind: 'profile', userId });
      return profile;
    },
  };
}
