import { describe, expect, it } from 'vitest';
import { HONEYPOT_FIELD, MIN_SUBMIT_MS, isSpamSubmission } from './anti-spam';

const NOW = 1_800_000_000_000;

describe('isSpamSubmission', () => {
  it('ผู้ใช้ปกติ (ฟิลด์ลวงว่าง + ใช้เวลากรอกนาน) → ไม่ใช่สแปม', () => {
    expect(
      isSpamSubmission({ websiteUrl: '', formStartedAt: NOW - 30_000 }, NOW),
    ).toBe(false);
  });

  it('ฟิลด์ลวงมีค่า → เป็นสแปม แม้ใช้เวลานาน', () => {
    expect(
      isSpamSubmission(
        { websiteUrl: 'https://spam.example', formStartedAt: NOW - 60_000 },
        NOW,
      ),
    ).toBe(true);
  });

  it('ฟิลด์ลวงเป็นช่องว่างอย่างเดียว (space) → เป็นสแปม (ผู้ใช้จริงส่งค่าว่างมา)', () => {
    // § บอทบางตัวกรอก space เพื่อเลี่ยง check ว่าง — ฟิลด์นี้ต้องว่างสนิทเท่านั้น
    expect(
      isSpamSubmission({ websiteUrl: ' ', formStartedAt: NOW - 60_000 }, NOW),
    ).toBe(true);
  });

  it('ส่งเร็วเกินเกณฑ์ → เป็นสแปม', () => {
    expect(
      isSpamSubmission(
        { websiteUrl: '', formStartedAt: NOW - (MIN_SUBMIT_MS - 1) },
        NOW,
      ),
    ).toBe(true);
  });

  it('ส่งช้าพอดีเกณฑ์ → ไม่ใช่สแปม', () => {
    expect(
      isSpamSubmission({ websiteUrl: '', formStartedAt: NOW - MIN_SUBMIT_MS }, NOW),
    ).toBe(false);
  });

  it('ไม่มี formStartedAt (client เก่า) → ไม่ปฏิเสธ', () => {
    expect(isSpamSubmission({ websiteUrl: '' }, NOW)).toBe(false);
  });

  it('timestamp อนาคต (นาฬิกา client เพี้ยน) → ไม่ปฏิเสธผู้ใช้จริง', () => {
    expect(
      isSpamSubmission({ websiteUrl: '', formStartedAt: NOW + 60_000 }, NOW),
    ).toBe(false);
  });

  it('HONEYPOT_FIELD ตรงกับ name ในฟอร์ม', () => {
    expect(HONEYPOT_FIELD).toBe('website_url');
  });
});
