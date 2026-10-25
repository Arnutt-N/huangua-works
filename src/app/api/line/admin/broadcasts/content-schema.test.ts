import { describe, expect, it } from 'vitest';
import { broadcastContentSchema as contentSchema } from '@/lib/line/broadcast-content-schema';

describe('broadcast contentSchema (schema จริงจาก route)', () => {
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

  it('flex ที่มี javascript: uri ไม่ผ่าน', () => {
    expect(
      contentSchema.safeParse({
        type: 'flex',
        altText: 'alt',
        contents: { body: { contents: [{ action: { type: 'uri', uri: 'javascript:alert(1)' } }] } },
      }).success,
    ).toBe(false);
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
