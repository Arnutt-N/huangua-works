import { describe, expect, it } from 'vitest';
import { caseStatusFlex, faqMenuFlex, handoffNotifyFlex, caseConfirmFlex, parseConfirmPostback, type CaseConfirmSummary } from './flex';
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

  it('maps all 8 known statuses to Thai labels', () => {
    const statuses = ['pending', 'received', 'reviewing', 'assigned', 'in_progress', 'done', 'closed', 'rejected'];
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

describe('parseConfirmPostback', () => {
  it('accepts all 6 protocol members', () => {
    const datas = [
      'confirm:ok',
      'confirm:cancel',
      'confirm:edit:category',
      'confirm:edit:title',
      'confirm:edit:description',
      'confirm:edit:location',
    ];
    for (const data of datas) {
      expect(parseConfirmPostback(data)).toBe(data);
    }
  });

  it('rejects non-confirm postbacks with null', () => {
    expect(parseConfirmPostback('faq:select:1')).toBeNull();
    expect(parseConfirmPostback('confirm:delete')).toBeNull();
    expect(parseConfirmPostback('')).toBeNull();
  });
});

describe('caseConfirmFlex', () => {
  const summary: CaseConfirmSummary = {
    categoryName: 'ถนน-ทางเท้า',
    title: 'ถนนพังหน้าบ้าน',
    description: 'มีหลุมบ่อใหญ่กลางถนน',
    location: 'หน้าวัดหัวงัว หมู่ 3',
  };
  // § ข้อความยินยอมสมมติของเทสต์ — wiring กับ BOT_CONSENT_NOTICE จริงตรวจที่ case-flow.test.ts
  const consent = 'การกดยืนยันถือว่ายินยอมให้เก็บข้อมูล ติดต่อ 043-601-494';

  function bodyContents(msg: LineOutgoingMessage) {
    return (asFlex(msg).contents.body as { contents: Array<Record<string, unknown>> }).contents;
  }

  function footerContents(msg: LineOutgoingMessage) {
    return (asFlex(msg).contents.footer as { contents: Array<Record<string, unknown>> }).contents;
  }

  /** เก็บ action postback ทั้ง bubble (แถวช่อง + footer) */
  function postbackActions(msg: LineOutgoingMessage): Array<{ label: unknown; data: unknown }> {
    const c = asFlex(msg).contents as {
      body: { contents: Array<Record<string, unknown>> };
      footer: { contents: Array<Record<string, unknown>> };
    };
    const out: Array<{ label: unknown; data: unknown }> = [];
    const visit = (node: Record<string, unknown>) => {
      const action = node.action as Record<string, unknown> | undefined;
      if (action?.type === 'postback') out.push({ label: action.label, data: action.data });
      const kids = node.contents as Array<Record<string, unknown>> | undefined;
      kids?.forEach(visit);
    };
    [...c.body.contents, ...c.footer.contents].forEach(visit);
    return out;
  }

  it('returns a bubble flex message', () => {
    const msg = asFlex(caseConfirmFlex(summary, consent));
    expect(msg.contents.type).toBe('bubble');
    expect(msg.contents).toHaveProperty('header');
    expect(msg.contents).toHaveProperty('body');
    expect(msg.contents).toHaveProperty('footer');
  });

  it('has one edit button per field (4 buttons with confirm:edit:* data)', () => {
    const actions = postbackActions(caseConfirmFlex(summary, consent));
    const edits = actions.filter((a) => typeof a.data === 'string' && a.data.startsWith('confirm:edit:'));
    expect(edits.map((a) => a.data).sort()).toEqual([
      'confirm:edit:category',
      'confirm:edit:description',
      'confirm:edit:location',
      'confirm:edit:title',
    ]);
  });

  it('footer has confirm (confirm:ok) and cancel (confirm:cancel) buttons', () => {
    const buttons = footerContents(caseConfirmFlex(summary, consent));
    expect(buttons).toHaveLength(2);
    const datas = buttons.map((b) => (b.action as Record<string, unknown>).data);
    expect(datas).toEqual(['confirm:ok', 'confirm:cancel']);
  });

  it('body shows all 4 field values', () => {
    const flat = JSON.stringify(bodyContents(caseConfirmFlex(summary, consent)));
    for (const value of Object.values(summary)) {
      expect(flat).toContain(value);
    }
  });

  it('altText carries the full summary including the consent wording', () => {
    const msg = asFlex(caseConfirmFlex(summary, consent));
    expect(msg.altText).toContain('สรุปเรื่องที่แจ้ง');
    for (const value of Object.values(summary)) {
      expect(msg.altText).toContain(value);
    }
    expect(msg.altText).toContain(consent);
  });
});