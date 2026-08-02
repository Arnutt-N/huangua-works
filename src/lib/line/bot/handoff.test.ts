import { describe, expect, it, vi } from 'vitest';

vi.mock('../settings', () => ({
  getChatSetting: vi.fn(async (key: string) => {
    if (key === 'handoff_keywords') {
      return ['ติดต่อเจ้าหน้าที่', 'เจ้าหน้าที่', 'คุยกับคน', 'พบเจ้าหน้าที่', 'handoff', 'operator', 'admin'];
    }
    return null;
  }),
}));

import { isHandoffRequest } from './handoff';

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
