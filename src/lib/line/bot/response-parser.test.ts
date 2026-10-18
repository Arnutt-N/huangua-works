import { describe, expect, it } from 'vitest';
import { buildMessageFromObject } from './response-parser';

describe('buildMessageFromObject type ใหม่', () => {
  it('sticker ครบ field', () => {
    expect(buildMessageFromObject('sticker', { packageId: '1', stickerId: '2' }, null))
      .toEqual({ type: 'sticker', packageId: '1', stickerId: '2' });
  });

  it('sticker ขาด field → null', () => {
    expect(buildMessageFromObject('sticker', { packageId: '1' }, null)).toBeNull();
  });

  it('video/audio/location/imagemap ครบ field', () => {
    expect(buildMessageFromObject('video', { url: 'https://x/v.mp4' }, null))
      .toEqual({ type: 'video', originalContentUrl: 'https://x/v.mp4', previewImageUrl: 'https://x/v.mp4' });
    expect(buildMessageFromObject('audio', { url: 'https://x/a.m4a', duration: 30 }, null))
      .toEqual({ type: 'audio', originalContentUrl: 'https://x/a.m4a', duration: 30 });
    expect(buildMessageFromObject('location', { title: 'ศาลากลาง', address: 'ถนนหลัก', latitude: 16, longitude: 103 }, null))
      ?.toMatchObject({ type: 'location', latitude: 16, longitude: 103 });
    expect(buildMessageFromObject('location', { latitude: 16, longitude: 103 }, null)).toBeNull();
    expect(buildMessageFromObject('imagemap', { baseUrl: 'https://x/', baseSize: { width: 1040, height: 1040 }, actions: [{ type: 'uri', label: 'เปิด', uri: 'https://x/' }] }, null))
      ?.toMatchObject({ type: 'imagemap', baseSize: { width: 1040, height: 1040 } });
    expect(buildMessageFromObject('imagemap', { baseUrl: 'https://x/', baseSize: { width: 1040, height: 1040 } }, null)).toBeNull();
  });

  it('text_v2 ออกเป็น text', () => {
    expect(buildMessageFromObject('text_v2', { text: 'สวัสดี' }, null))
      .toEqual({ type: 'text', text: 'สวัสดี' });
  });

  it('quickReply ผิดรูปถูกทิ้ง ไม่พังข้อความ', () => {
    expect(buildMessageFromObject('text', { text: 'a', quickReply: { items: [] } }, null))
      .toEqual({ type: 'text', text: 'a' });
    expect(buildMessageFromObject('text', { text: 'a', quickReply: { items: new Array(14).fill({ type: 'action', action: { type: 'message', label: 'x', text: 'x' } }) } }, null))
      .toEqual({ type: 'text', text: 'a' });
  });

  it('quickReply ถูกแนบท้ายทุก type', () => {
    const quickReply = { items: [{ type: 'action', action: { type: 'message', label: 'ใช่', text: 'ใช่' } }] };
    const msg = buildMessageFromObject('sticker', { packageId: '1', stickerId: '2', quickReply }, null);
    expect(msg).toMatchObject({ type: 'sticker', quickReply });
  });
});
