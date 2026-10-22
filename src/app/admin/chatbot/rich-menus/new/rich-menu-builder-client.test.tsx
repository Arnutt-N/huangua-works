// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RICH_MENU_TEMPLATES,
  areaStyle,
  templateByKey,
  validateArea,
} from '../rich-menu-templates';
import { RichMenuBuilderClient } from './rich-menu-builder-client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    createRichMenu: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  },
}));

afterEach(() => {
  cleanup();
});

describe('rich-menu-templates', () => {
  it('มี 3 เทมเพลต เริ่มด้วย 6 ปุ่ม 3x2', () => {
    expect(RICH_MENU_TEMPLATES).toHaveLength(3);
    expect(RICH_MENU_TEMPLATES[0]!.key).toBe('grid-3x2');
    expect(RICH_MENU_TEMPLATES[0]!.areas).toHaveLength(6);
  });

  it('templateByKey คืน default เมื่อ key ผิด', () => {
    expect(templateByKey('ไม่มี')).toBe(RICH_MENU_TEMPLATES[0]);
  });

  it('validateArea ตรวจ uri ต้อง https', () => {
    expect(validateArea({ type: 'uri', uri: '' })).toBeTruthy();
    expect(validateArea({ type: 'uri', uri: 'http://x' })).toBeTruthy();
    expect(validateArea({ type: 'uri', uri: 'https://x' })).toBeNull();
  });

  it('validateArea ตรวจ message ไม่ว่างไม่เกิน 300', () => {
    expect(validateArea({ type: 'message', text: '' })).toBeTruthy();
    expect(validateArea({ type: 'message', text: 'a'.repeat(301) })).toBeTruthy();
    expect(validateArea({ type: 'message', text: 'สวัสดี' })).toBeNull();
  });

  it('validateArea บล็อก placeholder LIFF_ID', () => {
    expect(validateArea({ type: 'uri', uri: 'https://liff.line.me/<LIFF_ID>/intake' })).toBe(
      'กรุณาแทน <LIFF_ID> ด้วยค่า LINE_LIFF_ID จริงก่อนบันทึก',
    );
  });

  it('areaStyle แปลง bounds เป็น percent', () => {
    const s = areaStyle(
      { x: 0, y: 0, width: 833, height: 843 },
      { width: 2500, height: 1686 },
    );
    expect(s.left).toBe('0%');
    expect(s.width).toContain('%');
  });
});

describe('RichMenuBuilderClient', () => {
  it('แสดงเทมเพลตและ 6 พื้นที่', () => {
    render(<RichMenuBuilderClient />);

    expect(screen.getByText('6 ปุ่ม (3×2)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'พื้นที่ 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'พื้นที่ 6' })).toBeInTheDocument();
  });

  it('สลับเทมเพลตเปลี่ยนจำนวนพื้นที่', async () => {
    const user = userEvent.setup();
    render(<RichMenuBuilderClient />);

    await user.click(screen.getByRole('button', { name: '4 ปุ่ม (2×2)' }));

    expect(screen.queryByRole('button', { name: 'พื้นที่ 6' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'พื้นที่ 4' })).toBeInTheDocument();
  });

  it('บล็อกเมื่อชื่อเมนูว่าง', async () => {
    const user = userEvent.setup();
    render(<RichMenuBuilderClient />);

    await user.click(screen.getByRole('button', { name: 'สร้างเมนู' }));

    expect(await screen.findByText('กรุณากรอกชื่อเมนู')).toBeInTheDocument();
  });
});
