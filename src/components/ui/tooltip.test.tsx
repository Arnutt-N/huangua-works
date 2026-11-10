// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ClipText, isTextClipped } from './tooltip';

afterEach(() => {
  cleanup();
});

function mockBox(el: HTMLElement, clipped: boolean) {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => (clipped ? 240 : 40) });
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => 40 });
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => 18 });
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => 18 });
}

describe('ClipText', () => {
  it('ป้ายบนการ์ดที่เห็นครบไม่มีทูลทิป', () => {
    render(<ClipText delayMs={0}>แดชบอร์ด</ClipText>);
    const label = screen.getByText('แดชบอร์ด');
    mockBox(label, false);
    fireEvent.pointerMove(label, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(label).not.toHaveAttribute('title');
  });

  it('ข้อความที่ล้นบนการ์ดโชว์ทูลทิปด้วยสีของธีม', async () => {
    render(<ClipText delayMs={0}>ผู้รับผิดชอบย้อนหลัง</ClipText>);
    const label = screen.getByText('ผู้รับผิดชอบย้อนหลัง');
    mockBox(label, true);
    fireEvent.pointerMove(label, { pointerType: 'mouse' });
    // Radix ใส่ role=tooltip บนสำเนาที่ซ่อนสำหรับโปรแกรมอ่านจอ
    // กล่องที่มองเห็นคือ Popper ซึ่งถือคลาสของธีม
    expect(await screen.findByRole('tooltip')).toHaveTextContent('ผู้รับผิดชอบย้อนหลัง');
    const bubble = document.body.querySelector('[data-side]');
    expect(bubble).not.toBeNull();
    expect(bubble?.className).toContain('bg-surface-raised');
    expect(bubble?.className).toContain('text-ink');
    expect(bubble?.className).toContain('border-border');
    expect(bubble?.className).toContain('font-sans');
  });

  it('isTextClipped ดูจากความกว้างเนื้อหาที่เกินกรอบ', () => {
    const el = document.createElement('span');
    mockBox(el, true);
    expect(isTextClipped(el)).toBe(true);
    mockBox(el, false);
    expect(isTextClipped(el)).toBe(false);
  });
});
