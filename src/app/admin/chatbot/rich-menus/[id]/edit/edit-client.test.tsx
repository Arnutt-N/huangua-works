// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RichMenuItemDetail } from '@/app/admin/_lib/admin-api';
import { RichMenuEditClient } from './edit-client';

const getRichMenu = vi.fn();
const listMenuAliases = vi.fn();
vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    getRichMenu: (...args: unknown[]) => getRichMenu(...args),
    listMenuAliases: (...args: unknown[]) => listMenuAliases(...args),
    updateRichMenu: vi.fn(),
    syncRichMenu: vi.fn(),
    publishRichMenu: vi.fn(),
    uploadRichMenuImage: vi.fn(),
  },
}));

function detail(over: Partial<RichMenuItemDetail> = {}): RichMenuItemDetail {
  return {
    id: 'm1',
    name: 'jsk4.0-v2',
    chatBarText: 'เปิด/ปิด เมนู',
    lineRichMenuId: 'richmenu-abc',
    status: 'active',
    displayMode: 'ALWAYS',
    syncStatus: 'synced',
    lastSyncError: null,
    imageUrl: null,
    displayStartAt: null,
    displayEndAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    config: {
      size: { width: 2500, height: 1686 },
      areas: [
        {
          bounds: { x: 0, y: 0, width: 1250, height: 1686 },
          action: { type: 'uri', uri: 'https://example.com' },
        },
        {
          bounds: { x: 1250, y: 0, width: 1250, height: 1686 },
          action: { type: 'message', text: 'ติดต่อเจ้าหน้าที่' },
        },
      ],
    },
    ...over,
  };
}

afterEach(() => cleanup());

beforeEach(() => {
  getRichMenu.mockReset();
  listMenuAliases.mockReset();
  getRichMenu.mockResolvedValue({ ok: true, data: detail() });
  listMenuAliases.mockResolvedValue({ ok: true, data: { items: [] } });
});

describe('RichMenuEditClient', () => {
  it('แก้ชื่อ/แถบแชทได้ + แสดง area actions และปุ่มบันทึก', async () => {
    render(<RichMenuEditClient menuId="m1" />);
    expect(await screen.findByText('แก้ไขเมนู: jsk4.0-v2')).toBeInTheDocument();
    expect(screen.getByLabelText('ชื่อเมนู')).toHaveValue('jsk4.0-v2');
    expect(screen.getByLabelText('Chat Bar Text')).toHaveValue('เปิด/ปิด เมนู');
    expect(screen.getByLabelText('ประเภทการทำงานพื้นที่ 1')).toBeInTheDocument();
    expect(screen.getByLabelText('ประเภทการทำงานพื้นที่ 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'บันทึกฉบับร่าง' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'บันทึกและซิงค์' })).toBeInTheDocument();
  });

  it('ไม่มีเมนูแสดงข้อความไทย', async () => {
    getRichMenu.mockResolvedValue({ ok: false, error: 'ไม่พบ rich menu', status: 404 });
    render(<RichMenuEditClient menuId="nope" />);
    expect(await screen.findByText('ไม่พบเมนูนี้')).toBeInTheDocument();
  });
});
