// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RICH_MENU_TEMPLATES,
  areaStyle,
  templateByKey,
  templatesByGroup,
  validateArea,
} from '../rich-menu-templates';
import { RichMenuBuilderClient } from './rich-menu-builder-client';

const listReplyObjects = vi.fn();
const listIntents = vi.fn();
const listMenuAliases = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    createRichMenu: vi.fn().mockResolvedValue({ ok: true, data: { id: 'm1' } }),
    listReplyObjects: (...args: unknown[]) => listReplyObjects(...args),
    listIntents: (...args: unknown[]) => listIntents(...args),
    listMenuAliases: (...args: unknown[]) => listMenuAliases(...args),
  },
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  listReplyObjects.mockResolvedValue({ ok: true, data: { items: [] } });
  listIntents.mockResolvedValue({ ok: true, data: { items: [] } });
  listMenuAliases.mockResolvedValue({ ok: true, data: { items: [] } });
});

describe('rich-menu-templates', () => {
  it('มี 11 เทมเพลต แยก Large 7 / Compact 4', () => {
    expect(RICH_MENU_TEMPLATES).toHaveLength(11);
    expect(templatesByGroup('Large')).toHaveLength(7);
    expect(templatesByGroup('Compact')).toHaveLength(4);
    expect(RICH_MENU_TEMPLATES[0]!.key).toBe('large-6');
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

  it('validateArea บล็อก placeholder LIFF_ID + บังคับ alias ของ richmenuswitch', () => {
    expect(validateArea({ type: 'uri', uri: 'https://liff.line.me/<LIFF_ID>/intake' })).toBe(
      'กรุณาแทน <LIFF_ID> ด้วยค่า LINE_LIFF_ID จริงก่อนบันทึก',
    );
    expect(validateArea({ type: 'richmenuswitch' })).toBe('ต้องเลือก alias ปลายทาง');
    expect(validateArea({ type: 'richmenuswitch', richMenuAliasId: 'a' })).toBeNull();
  });

  it('areaStyle แปลง bounds เป็น percent', () => {
    const s = areaStyle({ x: 0, y: 0, width: 833, height: 843 }, { width: 2500, height: 1686 });
    expect(s.left).toBe('0%');
    expect(s.width).toContain('%');
  });
});

describe('RichMenuBuilderClient', () => {
  it('แสดงเทมเพลตเริ่มต้นและครบ 6 พื้นที่', async () => {
    render(<RichMenuBuilderClient />);
    expect(await screen.findByText('6 Buttons (3x2)')).toBeInTheDocument();
    expect(screen.getByLabelText('ประเภทการทำงานพื้นที่ 1')).toBeInTheDocument();
    expect(screen.getByLabelText('ประเภทการทำงานพื้นที่ 6')).toBeInTheDocument();
  });

  it('เปิด modal เลือกเทมเพลตและเปลี่ยนจำนวนพื้นที่', async () => {
    const user = userEvent.setup();
    render(<RichMenuBuilderClient />);
    await user.click(screen.getByRole('button', { name: /Change Template/ }));
    expect(await screen.findByText('Select a template')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /4 Buttons \(2x2\)/ }));
    await user.click(screen.getByRole('button', { name: 'Apply Design' }));

    expect(screen.queryByLabelText('ประเภทการทำงานพื้นที่ 6')).not.toBeInTheDocument();
    expect(screen.getByLabelText('ประเภทการทำงานพื้นที่ 4')).toBeInTheDocument();
  });

  it('บล็อกเมื่อยังไม่กรอกชื่อเมนู', async () => {
    const user = userEvent.setup();
    render(<RichMenuBuilderClient />);
    await screen.findByText('6 Buttons (3x2)');

    await user.click(screen.getByRole('button', { name: 'บันทึกฉบับร่าง' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('กรุณากรอกชื่อเมนู');
  });
});
