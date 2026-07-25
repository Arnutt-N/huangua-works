import { describe, expect, it } from 'vitest';
import { caseStatusFlex, faqMenuFlex, handoffNotifyFlex } from './flex';
import type { LineOutgoingMessage } from '../types';

type FlexMsg = Extract<LineOutgoingMessage, { type: 'flex' }>;

function asFlex(msg: LineOutgoingMessage): FlexMsg {
  if (msg.type !== 'flex') throw new Error('expected flex message');
  return msg;
}

describe('caseStatusFlex', () => {
  it('returns a flex message with type "flex"', () => {
    const msg = caseStatusFlex('HN123456789', 'received', 'ถนนพัง');
    expect(msg.type).toBe('flex');
  });

  it('includes tracking code in altText', () => {
    const msg = asFlex(caseStatusFlex('HN123456789', 'received', 'ถนนพัง'));
    expect(msg.altText).toContain('HN123456789');
  });

  it('includes Thai status label in altText', () => {
    const msg = asFlex(caseStatusFlex('HN123456789', 'received', 'ถนนพัง'));
    expect(msg.altText).toContain('รับเรื่องแล้ว');
  });

  it('uses bubble container structure', () => {
    const msg = asFlex(caseStatusFlex('HN123456789', 'received', 'ถนนพัง'));
    const contents = msg.contents as Record<string, unknown>;
    expect(contents.type).toBe('bubble');
    expect(contents).toHaveProperty('header');
    expect(contents).toHaveProperty('body');
    expect(contents).toHaveProperty('footer');
  });

  it('embeds the title in the body contents', () => {
    const msg = asFlex(caseStatusFlex('HN123456789', 'received', 'ถนนพังหน้าบ้าน'));
    const body = msg.contents.body as { contents: Array<Record<string, unknown>> };
    const titleText = body.contents.find((c) => c.text === 'ถนนพังหน้าบ้าน');
    expect(titleText).toBeDefined();
  });

  it('falls back to raw status string for unknown status', () => {
    const msg = asFlex(caseStatusFlex('HN000000000', 'unknown_status', 'test'));
    expect(msg.altText).toContain('unknown_status');
  });

  it('maps all 7 known statuses to Thai labels', () => {
    const statuses = ['received', 'reviewing', 'assigned', 'in_progress', 'done', 'closed', 'rejected'];
    for (const s of statuses) {
      const msg = asFlex(caseStatusFlex('HN000000000', s, 't'));
      expect(msg.altText).not.toContain(s + ':');
    }
  });
});

describe('faqMenuFlex', () => {
  it('returns a flex message', () => {
    const msg = faqMenuFlex([{ label: 'ถนน', value: 'cat-1' }]);
    expect(msg.type).toBe('flex');
  });

  it('has altText about category selection', () => {
    const msg = asFlex(faqMenuFlex([]));
    expect(msg.altText).toContain('หมวดหมู่');
  });

  it('renders one button per category', () => {
    const cats = [
      { label: 'ถนน-ทางเท้า', value: 'c1' },
      { label: 'ไฟฟ้า', value: 'c2' },
      { label: 'น้ำประปา', value: 'c3' },
    ];
    const msg = asFlex(faqMenuFlex(cats));
    const body = msg.contents.body as { contents: Array<Record<string, unknown>> };
    expect(body.contents).toHaveLength(3);
    expect(body.contents[0]?.type).toBe('button');
  });

  it('button action is type "message" with label as text', () => {
    const msg = asFlex(faqMenuFlex([{ label: 'ขยะ', value: 'c1' }]));
    const body = msg.contents.body as { contents: Array<Record<string, unknown>> };
    const btn = body.contents[0];
    const action = btn?.action as Record<string, unknown>;
    expect(action?.type).toBe('message');
    expect(action?.text).toBe('ขยะ');
  });

  it('handles empty category list gracefully', () => {
    const msg = asFlex(faqMenuFlex([]));
    const body = msg.contents.body as { contents: unknown[] };
    expect(body.contents).toHaveLength(0);
  });
});

describe('handoffNotifyFlex', () => {
  it('returns a flex message', () => {
    const msg = handoffNotifyFlex();
    expect(msg.type).toBe('flex');
  });

  it('altText mentions connecting to staff', () => {
    const msg = asFlex(handoffNotifyFlex());
    expect(msg.altText).toContain('เจ้าหน้าที่');
  });

  it('body contains a heading and a sub-text', () => {
    const msg = asFlex(handoffNotifyFlex());
    const body = msg.contents.body as { contents: Array<Record<string, unknown>> };
    expect(body.contents).toHaveLength(2);
    expect(body.contents[0]).toHaveProperty('weight', 'bold');
  });
});