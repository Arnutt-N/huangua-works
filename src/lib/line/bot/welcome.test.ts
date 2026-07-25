import { describe, expect, it } from 'vitest';
import { getWelcomeMessages } from './welcome';

describe('getWelcomeMessages', () => {
  it('returns an array with at least one message', () => {
    const msgs = getWelcomeMessages();
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });

  it('first message is a text message', () => {
    const msgs = getWelcomeMessages();
    expect(msgs[0]?.type).toBe('text');
  });

  it('greets with the organization name', () => {
    const first = getWelcomeMessages()[0];
    const text = (first as { text: string }).text;
    expect(text).toContain('อบต.หัวงัว');
  });

  it('lists the 4 main commands', () => {
    const first = getWelcomeMessages()[0];
    const text = (first as { text: string }).text;
    expect(text).toContain('แจ้งเรื่อง');
    expect(text).toContain('ติดตาม');
    expect(text).toContain('ติดต่อเจ้าหน้าที่');
  });

  it('mentions tracking code format (HN prefix)', () => {
    const first = getWelcomeMessages()[0];
    const text = (first as { text: string }).text;
    expect(text).toMatch(/HNx+/);
  });
});