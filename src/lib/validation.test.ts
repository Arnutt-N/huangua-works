import { describe, it, expect } from 'vitest';
import {
  chatReplySchema,
  submitCaseSchema,
  updateConversationSchema,
  validateOrError,
} from './validation';
import { CONVERSATION_MODES } from './line/chat-modes';
import { conversationModeEnum } from './db/schema';

describe('updateConversationSchema', () => {
  it('accepts a valid mode', () => {
    const result = validateOrError(updateConversationSchema, { mode: 'human_active' });
    expect(result).toEqual({ success: true, data: { mode: 'human_active' } });
  });

  it('accepts linkedCaseId alone and null to unlink', () => {
    expect(validateOrError(updateConversationSchema, { linkedCaseId: 'case-1' }).success).toBe(true);
    expect(validateOrError(updateConversationSchema, { linkedCaseId: null }).success).toBe(true);
  });

  it('rejects a mode outside the DB enum', () => {
    expect(validateOrError(updateConversationSchema, { mode: 'DROP TABLE' }).success).toBe(false);
    expect(validateOrError(updateConversationSchema, { mode: 'Human_Active' }).success).toBe(false);
  });

  it('rejects an empty patch', () => {
    const result = validateOrError(updateConversationSchema, {});
    expect(result.success).toBe(false);
  });

  it('rejects non-string linkedCaseId', () => {
    expect(validateOrError(updateConversationSchema, { linkedCaseId: 42 }).success).toBe(false);
  });
});

describe('chatReplySchema', () => {
  it('trims the text', () => {
    const result = validateOrError(chatReplySchema, { text: '  สวัสดีครับ  ' });
    expect(result).toEqual({ success: true, data: { text: 'สวัสดีครับ' } });
  });

  it('rejects whitespace-only and missing text', () => {
    expect(validateOrError(chatReplySchema, { text: '   ' }).success).toBe(false);
    expect(validateOrError(chatReplySchema, {}).success).toBe(false);
  });

  it('rejects non-string text instead of crashing on .trim()', () => {
    expect(validateOrError(chatReplySchema, { text: 123 }).success).toBe(false);
    expect(validateOrError(chatReplySchema, { text: { a: 1 } }).success).toBe(false);
  });

  it("rejects text over LINE's 5000-char cap", () => {
    expect(validateOrError(chatReplySchema, { text: 'ก'.repeat(5000) }).success).toBe(true);
    expect(validateOrError(chatReplySchema, { text: 'ก'.repeat(5001) }).success).toBe(false);
  });
});

describe('submitCaseSchema — attachments[].url', () => {
  // /api/cases/submit ไม่ต้อง login — url ที่ผ่าน schema นี้ถูกเก็บลง cases.attachments
  // และจะกลายเป็น stored XSS ทันทีที่มีหน้าไหน render มันเป็นลิงก์
  const buildAttachment = (url: string) => ({
    url,
    type: 'image/png',
    size: 1024,
  });

  const parseUrl = (url: string) =>
    validateOrError(submitCaseSchema.shape.attachments, [buildAttachment(url)]).success;

  it('accepts http and https', () => {
    expect(parseUrl('https://storage.example/a.png')).toBe(true);
    expect(parseUrl('http://storage.example/a.png')).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
  ])('rejects the %s scheme', (url) => {
    // zod 4 ข้ามการตรวจ protocol ถ้าไม่ส่ง option — scheme เหล่านี้เคยผ่านมาก่อน
    expect(parseUrl(url)).toBe(false);
  });

  it('still enforces the 2048-char cap', () => {
    expect(parseUrl(`https://storage.example/${'a'.repeat(2048)}`)).toBe(false);
  });
});

describe('CONVERSATION_MODES', () => {
  it('is the source of the conversation_mode pgEnum', () => {
    expect(conversationModeEnum.enumValues).toEqual([...CONVERSATION_MODES]);
  });
});
