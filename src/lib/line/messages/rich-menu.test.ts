import { describe, expect, it } from 'vitest';
import { RICH_MENU_BODY, getFaqReply } from './rich-menu';

describe('RICH_MENU_BODY', () => {
  it('has the required LINE rich menu size (2500x1686)', () => {
    expect(RICH_MENU_BODY.size).toEqual({ width: 2500, height: 1686 });
  });

  it('is selected by default', () => {
    expect(RICH_MENU_BODY.selected).toBe(true);
  });

  it('has a chatBarText in Thai', () => {
    expect(RICH_MENU_BODY.chatBarText).toBe('เมนูหลัก');
  });

  it('has exactly 4 tappable areas (2x2 grid)', () => {
    expect(RICH_MENU_BODY.areas).toHaveLength(4);
  });

  it('all areas use message action type', () => {
    for (const area of RICH_MENU_BODY.areas) {
      expect(area.action.type).toBe('message');
    }
  });

  it('areas map to the 4 main commands', () => {
    const texts = RICH_MENU_BODY.areas.map((a) => a.action.text);
    expect(texts).toContain('แจ้งเรื่อง');
    expect(texts).toContain('ติดตาม');
    expect(texts).toContain('ติดต่อเจ้าหน้าที่');
    expect(texts).toContain('คำถามที่พบบ่อย');
  });

  it('layout forms a clean 2x2 grid (no overlap)', () => {
    const [a1, a2, a3, a4] = RICH_MENU_BODY.areas;
    // top-left + top-right share y=0, bottom-left + bottom-right share y=843
    expect(a1?.bounds).toEqual({ x: 0, y: 0, width: 1250, height: 843 });
    expect(a2?.bounds).toEqual({ x: 1250, y: 0, width: 1250, height: 843 });
    expect(a3?.bounds).toEqual({ x: 0, y: 843, width: 1250, height: 843 });
    expect(a4?.bounds).toEqual({ x: 1250, y: 843, width: 1250, height: 843 });
  });

  it('total area covers the full canvas', () => {
    const total = RICH_MENU_BODY.areas.reduce(
      (sum, a) => sum + a.bounds.width * a.bounds.height,
      0,
    );
    expect(total).toBe(2500 * 1686);
  });
});

describe('getFaqReply', () => {
  it('returns a text message', () => {
    const msg = getFaqReply();
    expect(msg.type).toBe('text');
  });

  it('mentions working hours', () => {
    const text = (getFaqReply() as { text: string }).text;
    expect(text).toContain('08:30');
    expect(text).toContain('16:30');
  });

  it('mentions contact phone placeholder', () => {
    const text = (getFaqReply() as { text: string }).text;
    expect(text).toContain('043-xxx-xxx');
  });

  it('lists the main service keywords', () => {
    const text = (getFaqReply() as { text: string }).text;
    expect(text).toContain('แจ้งเรื่อง');
    expect(text).toContain('ติดตาม');
    expect(text).toContain('ติดต่อเจ้าหน้าที่');
  });
});