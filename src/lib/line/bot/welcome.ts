import type { LineOutgoingMessage } from '../types';

export function getWelcomeMessages(): LineOutgoingMessage[] {
  return [
    {
      type: 'text',
      text: 'สวัสดีครับ ยินดีต้อนรับสู่ อบต.หัวงัว 🏛️\n\nเลือกบริการที่ต้องการ:\n\n📢 แจ้งเรื่อง — พิมพ์ "แจ้งเรื่อง"\n🔍 ติดตามสถานะ — พิมพ์ "ติดตาม HNxxxxxxxxx"\n❓ คำถามที่พบบ่อย — พิมพ์คำถามได้เลย\n🙋 ติดต่อเจ้าหน้าที่ — พิมพ์ "ติดต่อเจ้าหน้าที่"',
    },
  ];
}
