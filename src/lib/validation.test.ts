import { describe, it, expect } from 'vitest';
import {
  chatReplySchema,
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

describe('CONVERSATION_MODES', () => {
  it('is the source of the conversation_mode pgEnum', () => {
    expect(conversationModeEnum.enumValues).toEqual([...CONVERSATION_MODES]);
  });
});
