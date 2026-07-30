// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CannedPicker } from './canned-picker';
import type { CannedResponse } from '../_lib/types';

beforeAll(() => {
  // jsdom ไม่มี scrollIntoView — component เรียกตอน highlight เปลี่ยน
  Element.prototype.scrollIntoView = vi.fn();
});

const items: CannedResponse[] = [
  { id: '1', title: 'ทักทาย', shortcut: 'hello', content: 'สวัสดีครับ' },
  { id: '2', title: 'ขอบคุณ', shortcut: 'thanks', content: 'ขอบคุณที่ติดต่อมา' },
  { id: '3', title: 'ปิดเรื่อง', shortcut: null, content: 'ดำเนินการเรียบร้อยแล้ว' },
];

afterEach(cleanup);

describe('CannedPicker keyboard navigation', () => {
  it('renders all items and highlights the first by default', () => {
    render(<CannedPicker items={items} filter="" onPick={vi.fn()} onClose={vi.fn()} />);
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('moves highlight with ArrowDown/ArrowUp and clamps at edges', () => {
    render(<CannedPicker items={items} filter="" onPick={vi.fn()} onClose={vi.fn()} />);
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');

    // clamp ล่างสุด
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true');

    // clamp บนสุด
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('picks the highlighted item with Enter', () => {
    const onPick = vi.fn();
    render(<CannedPicker items={items} filter="" onPick={onPick} onClose={vi.fn()} />);
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith(items[1]);
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    render(<CannedPicker items={items} filter="" onPick={vi.fn()} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('filters by title/shortcut/content', () => {
    render(<CannedPicker items={items} filter="thanks" onPick={vi.fn()} onClose={vi.fn()} />);
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('ขอบคุณ');
  });

  it('shows empty state when nothing matches', () => {
    render(<CannedPicker items={items} filter="zzz" onPick={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('ไม่พบข้อความสำเร็จรูป')).toBeTruthy();
  });
});
