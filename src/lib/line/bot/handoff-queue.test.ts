import { describe, expect, it, vi } from 'vitest';

vi.mock('../settings', () => ({
  getChatSetting: vi.fn(async () => ['ติดต่อเจ้าหน้าที่']),
}));

vi.mock('../conversation', () => ({
  changeMode: vi.fn(async () => ({ ok: true, changed: true })),
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => [{ id: 'other-1' }, { id: 'conv-1' }],
        }),
      }),
    }),
  })),
}));

const { triggerHandoff } = await import('./handoff');

describe('triggerHandoff · แจ้งคิวรอ', () => {
  it('คืน flex + text ที่บอกตำแหน่งคิว', async () => {
    const replies = await triggerHandoff('conv-1');

    expect(replies).toHaveLength(2);
    expect(replies[0]).toMatchObject({ type: 'flex' });
    expect(replies[1]).toMatchObject({ type: 'text' });
    // text ต้องมีข้อมูลคิว (ไม่ใช่แค่ "รอสักครู่" ลอยๆ)
    expect((replies[1] as { text: string }).text).toMatch(/คิวที่ \d+/);
  });
});
