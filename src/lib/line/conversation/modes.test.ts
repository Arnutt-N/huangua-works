import { describe, expect, it } from 'vitest';
import { CONVERSATION_MODES } from '../chat-modes';
import { MODE_TRANSITIONS, allowedSourceModes, canTransition, isHumanHandled } from './modes';

describe('MODE_TRANSITIONS', () => {
  it('มี entry ครบทุกโหมด', () => {
    expect(Object.keys(MODE_TRANSITIONS).sort()).toEqual([...CONVERSATION_MODES].sort());
  });

  it('ไม่มี self-transition (เปลี่ยนเป็นโหมดเดิมจัดการเป็น idempotent ใน service)', () => {
    for (const mode of CONVERSATION_MODES) {
      expect(canTransition(mode, mode)).toBe(false);
    }
  });
});

describe('canTransition', () => {
  it.each([
    ['bot_active', 'waiting_handoff'],
    ['bot_active', 'human_active'],
    ['bot_active', 'resolved'],
    ['waiting_handoff', 'human_active'],
    ['waiting_handoff', 'bot_active'],
    ['waiting_handoff', 'resolved'],
    ['human_active', 'bot_active'],
    ['human_active', 'resolved'],
    ['resolved', 'bot_active'],
    ['resolved', 'waiting_handoff'],
  ] as const)('%s → %s ได้', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['human_active', 'waiting_handoff'],
    ['resolved', 'human_active'],
  ] as const)('%s → %s ไม่ได้', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});

describe('allowedSourceModes', () => {
  it('§ human_active รับได้จาก bot_active/waiting_handoff เท่านั้น — ตรงกับ claim guard เดิมใน PATCH', () => {
    expect(allowedSourceModes('human_active')).toEqual(['bot_active', 'waiting_handoff']);
  });

  it('waiting_handoff มาได้จาก bot_active และ resolved', () => {
    expect(allowedSourceModes('waiting_handoff')).toEqual(['bot_active', 'resolved']);
  });
});

describe('isHumanHandled', () => {
  it('human_active และ waiting_handoff = บอทเงียบ + นับ unread ให้แอดมิน', () => {
    expect(isHumanHandled('human_active')).toBe(true);
    expect(isHumanHandled('waiting_handoff')).toBe(true);
    expect(isHumanHandled('bot_active')).toBe(false);
    expect(isHumanHandled('resolved')).toBe(false);
  });
});
