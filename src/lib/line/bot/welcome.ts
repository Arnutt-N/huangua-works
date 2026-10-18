import type { LineOutgoingMessage } from '../types';
import { getChatSetting } from '../settings';

export interface WelcomeFill {
  displayName?: string | null;
  followCount?: number | null;
}

/**
 * แทนค่า placeholder ด้วย str.replace ธรรมดา (ไม่ใช่ format string)
 * ไม่มีข้อมูลให้แทนด้วยค่าว่าง — ห้ามเหลือ {display_name} ค้างในข้อความที่ส่ง
 * {follow_count} มาจากจำนวนแถว follow ใน line_friend_events (คำนวณใน friend-events.ts)
 */
export function fillWelcomeTemplate(text: string, fill: WelcomeFill): string {
  return text
    .replaceAll('{display_name}', fill.displayName ?? '')
    .replaceAll('{follow_count}', fill.followCount != null ? String(fill.followCount) : '');
}

export async function getWelcomeMessages(fill: WelcomeFill = {}): Promise<LineOutgoingMessage[]> {
  const text = await getChatSetting('welcome_message');
  return [{ type: 'text', text: fillWelcomeTemplate(text, fill) }];
}
