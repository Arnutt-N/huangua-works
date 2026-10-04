import { beforeEach, describe, expect, it, vi } from 'vitest';

// mock DB ที่รองรับทั้ง `await …where()` และ `…where().returning()` —
// ให้เทสต์นี้ใช้ต่อได้หลัง Task 7 ย้าย triggerHandoff ไปใช้ changeMode
const dbMocks = vi.hoisted(() => {
  const returning = vi.fn(async (): Promise<unknown[]> => [{ id: 'conv-1' }]);
  const where = vi.fn(() => Object.assign(Promise.resolve(undefined), { returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const limit = vi.fn(async (): Promise<unknown[]> => []);
  const select = vi.fn(() => ({ from: () => ({ where: () => ({ limit }) }) }));
  return { returning, where, set, update, limit, select };
});

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => ({ update: dbMocks.update, select: dbMocks.select })),
}));

vi.mock('../sse/broadcaster', () => ({ broadcast: vi.fn() }));

vi.mock('../settings', () => ({
  getChatSetting: vi.fn(async (key: string) => {
    if (key === 'handoff_keywords') {
      return ['ติดต่อเจ้าหน้าที่', 'เจ้าหน้าที่', 'คุยกับคน', 'พบเจ้าหน้าที่', 'handoff', 'operator', 'admin'];
    }
    return null;
  }),
}));

import { isHandoffRequest, triggerHandoff } from './handoff';
import { broadcast } from '../sse/broadcaster';

describe('isHandoffRequest', () => {
  describe('detects handoff keywords (Thai)', () => {
    it('matches "ติดต่อเจ้าหน้าที่"', async () => {
      expect(await isHandoffRequest('ติดต่อเจ้าหน้าที่')).toBe(true);
    });
    it('matches "เจ้าหน้าที่" embedded in a sentence', async () => {
      expect(await isHandoffRequest('อยากคุยกับเจ้าหน้าที่ครับ')).toBe(true);
    });
    it('matches "คุยกับคน"', async () => {
      expect(await isHandoffRequest('คุยกับคนหน่อย')).toBe(true);
    });
    it('matches "พบเจ้าหน้าที่"', async () => {
      expect(await isHandoffRequest('ขอพบเจ้าหน้าที่')).toBe(true);
    });
  });

  describe('detects handoff keywords (English)', () => {
    it('matches "handoff"', async () => {
      expect(await isHandoffRequest('handoff please')).toBe(true);
    });
    it('matches "operator"', async () => {
      expect(await isHandoffRequest('connect to operator')).toBe(true);
    });
    it('matches "admin"', async () => {
      expect(await isHandoffRequest('talk to admin')).toBe(true);
    });
  });

  describe('case-insensitive', () => {
    it('matches HANDOFF uppercase', async () => {
      expect(await isHandoffRequest('HANDOFF')).toBe(true);
    });
    it('matches Operator mixed case', async () => {
      expect(await isHandoffRequest('Operator')).toBe(true);
    });
  });

  describe('whitespace tolerant', () => {
    it('trims leading/trailing spaces', async () => {
      expect(await isHandoffRequest('  ติดต่อเจ้าหน้าที่  ')).toBe(true);
    });
  });

  describe('does NOT trigger on normal messages', () => {
    it('ignores "แจ้งเรื่อง"', async () => {
      expect(await isHandoffRequest('แจ้งเรื่อง')).toBe(false);
    });
    it('ignores "ติดตาม HN123456789"', async () => {
      expect(await isHandoffRequest('ติดตาม HN123456789')).toBe(false);
    });
    it('ignores empty string', async () => {
      expect(await isHandoffRequest('')).toBe(false);
    });
    it('ignores unrelated English text', async () => {
      expect(await isHandoffRequest('hello world')).toBe(false);
    });
    it('ignores partial match "เจ้า" without "หน้าที่"', async () => {
      expect(await isHandoffRequest('เจ้าบ้าน')).toBe(false);
    });
  });
});

describe('triggerHandoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('§ broadcast mode_change หลังเปลี่ยนเป็น waiting_handoff — inbox แอดมินต้องไม่ค้าง bot_active', async () => {
    const replies = await triggerHandoff('conv-1');

    expect(dbMocks.set).toHaveBeenCalledWith(expect.objectContaining({ mode: 'waiting_handoff' }));
    expect(broadcast).toHaveBeenCalledWith({
      type: 'mode_change',
      conversationId: 'conv-1',
      payload: { mode: 'waiting_handoff' },
    });
    expect(replies[0]!.type).toBe('flex');
    expect(replies[1]).toEqual({ type: 'text', text: 'ระบบได้แจ้งเจ้าหน้าที่แล้วครับ กรุณารอสักครู่' });
  });
});
