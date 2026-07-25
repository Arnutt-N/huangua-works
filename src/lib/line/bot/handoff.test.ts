import { describe, expect, it } from 'vitest';
import { isHandoffRequest } from './handoff';

describe('isHandoffRequest', () => {
  describe('detects handoff keywords (Thai)', () => {
    it('matches "ติดต่อเจ้าหน้าที่"', () => {
      expect(isHandoffRequest('ติดต่อเจ้าหน้าที่')).toBe(true);
    });
    it('matches "เจ้าหน้าที่" embedded in a sentence', () => {
      expect(isHandoffRequest('อยากคุยกับเจ้าหน้าที่ครับ')).toBe(true);
    });
    it('matches "คุยกับคน"', () => {
      expect(isHandoffRequest('คุยกับคนหน่อย')).toBe(true);
    });
    it('matches "พบเจ้าหน้าที่"', () => {
      expect(isHandoffRequest('ขอพบเจ้าหน้าที่')).toBe(true);
    });
  });

  describe('detects handoff keywords (English)', () => {
    it('matches "handoff"', () => {
      expect(isHandoffRequest('handoff please')).toBe(true);
    });
    it('matches "operator"', () => {
      expect(isHandoffRequest('connect to operator')).toBe(true);
    });
    it('matches "admin"', () => {
      expect(isHandoffRequest('talk to admin')).toBe(true);
    });
  });

  describe('case-insensitive', () => {
    it('matches HANDOFF uppercase', () => {
      expect(isHandoffRequest('HANDOFF')).toBe(true);
    });
    it('matches Operator mixed case', () => {
      expect(isHandoffRequest('Operator')).toBe(true);
    });
  });

  describe('whitespace tolerant', () => {
    it('trims leading/trailing spaces', () => {
      expect(isHandoffRequest('  ติดต่อเจ้าหน้าที่  ')).toBe(true);
    });
  });

  describe('does NOT trigger on normal messages', () => {
    it('ignores "แจ้งเรื่อง"', () => {
      expect(isHandoffRequest('แจ้งเรื่อง')).toBe(false);
    });
    it('ignores "ติดตาม HN123456789"', () => {
      expect(isHandoffRequest('ติดตาม HN123456789')).toBe(false);
    });
    it('ignores empty string', () => {
      expect(isHandoffRequest('')).toBe(false);
    });
    it('ignores unrelated English text', () => {
      expect(isHandoffRequest('hello world')).toBe(false);
    });
    it('ignores partial match "เจ้า" without "หน้าที่"', () => {
      expect(isHandoffRequest('เจ้าบ้าน')).toBe(false);
    });
  });
});