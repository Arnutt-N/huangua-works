import { describe, expect, it } from 'vitest';
import { validateReplyPayload } from './reply-object-validation';

describe('validateReplyPayload — action uri scheme (server-side)', () => {
  it('ปฏิเสธ javascript: ที่ซ่อนใน flex payload', () => {
    const payload = {
      type: 'bubble',
      body: {
        type: 'box',
        contents: [{ type: 'button', action: { type: 'uri', label: 'x', uri: 'javascript:alert(1)' } }],
      },
    };
    const error = validateReplyPayload('flex', payload);
    expect(error).toContain('ลิงก์ไม่ปลอดภัยหรือไม่รองรับ');
    expect(error).toContain('javascript:alert(1)');
  });

  it('ปฏิเสธ quickReply ที่ใช้ data: แม้ z.string().url() จะรับ', () => {
    const payload = {
      type: 'bubble',
      quickReply: {
        items: [{ type: 'action', action: { type: 'uri', label: 'x', uri: 'data:text/html,x' } }],
      },
    };
    expect(validateReplyPayload('flex', payload)).toContain('ลิงก์ไม่ปลอดภัยหรือไม่รองรับ');
  });

  it('รับ https: ที่ถูกต้อง', () => {
    const payload = {
      type: 'bubble',
      body: {
        type: 'box',
        contents: [{ type: 'button', action: { type: 'uri', label: 'x', uri: 'https://example.com' } }],
      },
    };
    expect(validateReplyPayload('flex', payload)).toBeNull();
  });

  it('ยังคง shape error เดิมก่อนถึงขั้นตรวจ uri', () => {
    expect(validateReplyPayload('flex', {})).toContain('payload ต้องไม่ว่าง');
  });
});
