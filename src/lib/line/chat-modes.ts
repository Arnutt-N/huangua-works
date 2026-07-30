/**
 * โหมดของบทสนทนา LINE — เจ้าของค่าเดียวของ conversation_mode
 *
 * pure module (ไม่ import อะไร) เพราะทั้ง schema.ts (pgEnum) และ validation.ts (zod)
 * ต้องอ้างค่าชุดเดียวกัน — ถ้า validation.ts import schema.ts จะลาก drizzle เข้า client bundle
 */
export const CONVERSATION_MODES = [
  'bot_active',
  'waiting_handoff',
  'human_active',
  'resolved',
] as const;

export type ConversationMode = (typeof CONVERSATION_MODES)[number];
