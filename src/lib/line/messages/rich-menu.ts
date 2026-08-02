import type { LineOutgoingMessage } from '../types';
import { createLineRichMenu, uploadLineRichMenuImage, setDefaultLineRichMenu } from '../client';

export const RICH_MENU_BODY = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'กองช่าง อบต.หัวงัว Main Menu',
  chatBarText: 'เมนูหลัก',
  areas: [
    {
      bounds: { x: 0, y: 0, width: 1250, height: 843 },
      action: { type: 'message', text: 'แจ้งเรื่อง' },
    },
    {
      bounds: { x: 1250, y: 0, width: 1250, height: 843 },
      action: { type: 'message', text: 'ติดตาม' },
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
    text: 'คำถามที่พบบ่อย:\n\n🕐 เวลาทำการ: จ-ศ 08:30-16:30\n📞 ติดต่อ: 043-xxx-xxx\n📢 แจ้งเรื่อง: พิมพ์ "แจ้งเรื่อง"\n🔍 ติดตาม: พิมพ์ "ติดตาม HNxxxxxxxxx"\n🛣️ ถนน/ทางเท้า\n💡 ไฟฟ้า/แสงสว่าง\n💧 น้ำประปา\n🗑️ ขยะ\n\nพิมพ์คำถามได้เลย หรือพิมพ์ "ติดต่อเจ้าหน้าที่" เพื่อพูดคุยกับเจ้าหน้าที่',
  };
}
