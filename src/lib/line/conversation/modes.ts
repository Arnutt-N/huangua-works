/**
 * ตารางเปลี่ยนโหมดบทสนทนา LINE — ผู้ตัดสินเดียวว่าเปลี่ยนจากโหมดไหนไปโหมดไหนได้
 *
 * pure module (import แค่ chat-modes ที่ pure เหมือนกัน) — ใช้ได้ทั้งฝั่ง server และ client
 * pgEnum ไม่บังคับ transition — mode-service แปลงตารางนี้เป็น WHERE mode IN (…) แบบ atomic
 */
import { CONVERSATION_MODES, type ConversationMode } from '../chat-modes';

export const MODE_TRANSITIONS: Readonly<Record<ConversationMode, readonly ConversationMode[]>> = {
  bot_active: ['waiting_handoff', 'human_active', 'resolved'],
  waiting_handoff: ['bot_active', 'human_active', 'resolved'],
  human_active: ['bot_active', 'resolved'],
  // § resolved → waiting_handoff ต้องได้ — engine ปล่อยห้องที่ปิดแล้วคุยกับบอทต่อ
  // ผู้ใช้จึงพิมพ์ "ติดต่อเจ้าหน้าที่" จากห้อง resolved ได้
  resolved: ['bot_active', 'waiting_handoff'],
};

export function canTransition(from: ConversationMode, to: ConversationMode): boolean {
  return MODE_TRANSITIONS[from].includes(to);
}

/** โหมดต้นทางทั้งหมดที่เปลี่ยนมาเป็น `to` ได้ — ใช้สร้าง atomic guard ใน UPDATE */
export function allowedSourceModes(to: ConversationMode): ConversationMode[] {
  return CONVERSATION_MODES.filter((from) => canTransition(from, to));
}

/** โหมดที่เจ้าหน้าที่ดูแล: บอทต้องเงียบ และข้อความเข้าต้องนับ unread ให้แอดมิน */
export function isHumanHandled(mode: ConversationMode): boolean {
  return mode === 'human_active' || mode === 'waiting_handoff';
}
