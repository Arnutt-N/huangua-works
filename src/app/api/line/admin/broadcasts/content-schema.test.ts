import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const httpsUrl = z.string().url().refine((u) => u.startsWith('https://'), 'ต้องเป็น https URL');
const contentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().min(1).max(5000) }).passthrough(),
  z.object({ type: z.literal('image'), originalContentUrl: httpsUrl, previewImageUrl: httpsUrl }).passthrough(),
  z.object({ type: z.literal('flex'), altText: z.string().min(1).max(400), contents: z.record(z.string(), z.unknown()) }).passthrough(),
]);

// § schema นี้ mirror createSchema ใน route.ts — bypass wizard POST ตรงต้อง fail ที่ boundary
// ไม่ไปแตกตอน send/cron
describe('broadcast contentSchema (mirror route createSchema)', () => {
  it('text ว่างไม่ผ่าน', () => {
    expect(contentSchema.safeParse({ type: 'text', text: '' }).success).toBe(false);
  });

  it('image http ไม่ผ่าน', () => {
    expect(
      contentSchema.safeParse({ type: 'image', originalContentUrl: 'http://x/a.jpg', previewImageUrl: 'http://x/a.jpg' }).success,
    ).toBe(false);
  });

  it('flex ขาด altText ไม่ผ่าน', () => {
    expect(contentSchema.safeParse({ type: 'flex', contents: {} }).success).toBe(false);
  });

  it('type นอก union ไม่ผ่าน', () => {
    expect(contentSchema.safeParse({ type: 'video', url: 'https://x/a.mp4' }).success).toBe(false);
  });

  it('text/image/flex ถูกผ่าน', () => {
    expect(contentSchema.safeParse({ type: 'text', text: 'สวัสดี' }).success).toBe(true);
    expect(
      contentSchema.safeParse({
        type: 'image',
        originalContentUrl: 'https://x/a.jpg',
        previewImageUrl: 'https://x/a.jpg',
      }).success,
    ).toBe(true);
    expect(contentSchema.safeParse({ type: 'flex', altText: 'alt', contents: {} }).success).toBe(true);
  });
});
