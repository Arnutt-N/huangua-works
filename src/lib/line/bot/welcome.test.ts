import { describe, expect, it, vi } from 'vitest';

vi.mock('../settings', () => ({
  getChatSetting: vi.fn(async (key: string) => {
    if (key === 'welcome_message') {
      return 'สวัสดีครับ ยินดีต้อนรับสู่ อบต.หัวงัว 🏛️\n\nเลือกบริการที่ต้องการ:\n\n📢 แจ้งเรื่อง — พิมพ์ "แจ้งเรื่อง"\n🔍 ติดตามสถานะ — พิมพ์ "ติดตาม HGxxxxxxxxx"\n❓ คำถามที่พบบ่อย — พิมพ์คำถามได้เลย\n🙋 ติดต่อเจ้าหน้าที่ — พิมพ์ "ติดต่อเจ้าหน้าที่"';
    }
    return null;
  }),
}));

import { getWelcomeMessages } from './welcome';

describe('getWelcomeMessages', () => {
  it('returns an array with at least one message', async () => {
    const msgs = await getWelcomeMessages();
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });

  it('first message is a text message', async () => {
    const msgs = await getWelcomeMessages();
    expect(msgs[0]?.type).toBe('text');
  });

  it('greets with the organization name', async () => {
    const first = (await getWelcomeMessages())[0];
    const text = (first as { text: string }).text;
    expect(text).toContain('อบต.หัวงัว');
  });

  it('lists the 4 main commands', async () => {
    const first = (await getWelcomeMessages())[0];
    const text = (first as { text: string }).text;
    expect(text).toContain('แจ้งเรื่อง');
    expect(text).toContain('ติดตาม');
    expect(text).toContain('ติดต่อเจ้าหน้าที่');
  });

  it('mentions tracking code format (HG prefix)', async () => {
    const first = (await getWelcomeMessages())[0];
    const text = (first as { text: string }).text;
    expect(text).toMatch(/HGx+/);
  });
});
