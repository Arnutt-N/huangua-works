import type { LineOutgoingMessage } from '../types';

const LINE_API_BASE = 'https://api.line.me/v2/bot';

function getHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
  };
}

export const RICH_MENU_BODY = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'อบต.หัวงัว Main Menu',
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
  const res = await fetch(`${LINE_API_BASE}/richmenu`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(RICH_MENU_BODY),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.richMenuId;
}

export async function setDefaultRichMenu(richMenuId: string): Promise<boolean> {
  const res = await fetch(`${LINE_API_BASE}/user/all/richmenu/${richMenuId}`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return res.ok;
}

export async function uploadRichMenuImage(richMenuId: string, imageBuffer: Buffer): Promise<boolean> {
  const res = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/png',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: new Uint8Array(imageBuffer),
  });
  return res.ok;
}

export function getFaqReply(): LineOutgoingMessage {
  return {
    type: 'text',
    text: 'คำถามที่พบบ่อย:\n\n🕐 เวลาทำการ: จ-ศ 08:30-16:30\n📞 ติดต่อ: 043-xxx-xxx\n📢 แจ้งเรื่อง: พิมพ์ "แจ้งเรื่อง"\n🔍 ติดตาม: พิมพ์ "ติดตาม HNxxxxxxxxx"\n🛣️ ถนน/ทางเท้า\n💡 ไฟฟ้า/แสงสว่าง\n💧 น้ำประปา\n🗑️ ขยะ\n\nพิมพ์คำถามได้เลย หรือพิมพ์ "ติดต่อเจ้าหน้าที่" เพื่อพูดคุยกับเจ้าหน้าที่',
  };
}
