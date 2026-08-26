import type { LineOutgoingMessage } from '../types';
import { createLineRichMenu, uploadLineRichMenuImage, setDefaultLineRichMenu } from '../client';
import { liffUrl } from '@/lib/liff/config';
import { COPY } from '@/lib/copy';

/**
 * § เมื่อตั้ง NEXT_PUBLIC_LIFF_ID แล้ว ปุ่ม "แจ้งเรื่องใหม่"/"ติดตามเรื่อง" เปลี่ยนจากส่งข้อความ
 * หาบอทเป็นเปิดฟอร์ม LIFF โดยตรง (path ที่ต่อท้าย liff.line.me/<id> จะถูกนำไปต่อท้าย
 * path ของ Endpoint URL ไม่ใช่แทนที่ — Endpoint ต้องตั้งเป็น root โดเมน ดู § ใน
 * lib/liff/config.ts) — ยังไม่ตั้ง = ใช้พฤติกรรมเดิม (ส่งข้อความหาบอท)
 *
 * ⚠️ เมนูที่อัปโหลดไป LINE แล้วไม่เปลี่ยนเอง — หลังใส่ env ต้องรัน
 * `npx tsx scripts/upload-rich-menu.ts` (หรือ sync ผ่าน /admin/chatbot/rich-menus) ใหม่
 */
const intakeAction = liffUrl('/intake')
  ? { type: 'uri' as const, uri: liffUrl('/intake')! }
  : { type: 'message' as const, text: COPY.INTAKE_LABEL };

const trackAction = liffUrl('/track')
  ? { type: 'uri' as const, uri: liffUrl('/track')! }
  : { type: 'message' as const, text: COPY.TRACK_LABEL };

export const RICH_MENU_BODY = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'กองช่าง อบต.หัวงัว Main Menu',
  chatBarText: 'เมนูหลัก',
  areas: [
    {
      bounds: { x: 0, y: 0, width: 1250, height: 843 },
      action: intakeAction,
    },
    {
      bounds: { x: 1250, y: 0, width: 1250, height: 843 },
      action: trackAction,
    },
    {
      bounds: { x: 0, y: 843, width: 1250, height: 843 },
      action: { type: 'message', text: 'ติดต่อเจ้าหน้าที่' },
    },
    {
      bounds: { x: 1250, y: 843, width: 1250, height: 843 },
      action: { type: 'message', text: 'คำถามที่พบบ่อย' },
    },
  ],
};

export async function createRichMenu(): Promise<string | null> {
  try {
    return await createLineRichMenu(RICH_MENU_BODY);
  } catch {
    return null;
  }
}

export async function setDefaultRichMenu(richMenuId: string): Promise<boolean> {
  try {
    await setDefaultLineRichMenu(richMenuId);
    return true;
  } catch {
    return false;
  }
}

export async function uploadRichMenuImage(richMenuId: string, imageBuffer: Buffer): Promise<boolean> {
  try {
    await uploadLineRichMenuImage(richMenuId, imageBuffer);
    return true;
  } catch {
    return false;
  }
}

export function getFaqReply(): LineOutgoingMessage {
  return {
    type: 'text',
    text: `คำถามที่พบบ่อย:\n\n🕐 เวลาทำการ: จ-ศ 08:30-16:30\n📞 ติดต่อ: ${COPY.ORG_PHONE}\n📢 ${COPY.INTAKE_LABEL}: พิมพ์ "${COPY.INTAKE_LABEL}"\n🔍 ${COPY.TRACK_LABEL}: พิมพ์ "ติดตาม HGxxxxxxxxx"\n🛣️ ถนน/ทางเท้า\n💡 ไฟฟ้า/แสงสว่าง\n💧 น้ำประปา\n🗑️ ขยะ\n\nพิมพ์คำถามได้เลย หรือพิมพ์ "ติดต่อเจ้าหน้าที่" เพื่อพูดคุยกับเจ้าหน้าที่`,
  };
}
