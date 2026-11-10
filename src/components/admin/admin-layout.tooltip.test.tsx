// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-media-query', () => ({
  useMediaQuery: () => ({ isDesktop: true, hydrated: true }),
}));

vi.mock('@/components/site/brand-mark', () => ({
  BrandMark: () => <span>brand</span>,
}));

vi.mock('@/components/admin/user-menu', () => ({
  UserMenu: () => <button>user</button>,
}));

vi.mock('@/components/admin/session-timeout-warning', () => ({
  SessionTimeoutWarning: () => null,
}));

import { AdminLayout } from '@/components/admin/admin-layout';

afterEach(() => {
  cleanup();
  window.localStorage.removeItem('admin:sidebar-collapsed');
});

function renderLayout() {
  render(
    <AdminLayout user={{ fullName: 'T', email: 't@x.go.th', role: 'superadmin' }} active="dashboard" title="แดชบอร์ด">
      <p>content</p>
    </AdminLayout>,
  );
}

describe('ไซดบาร์ใช้ทูลทิปธีมเดียวกับส่วนอื่น', () => {
  it('ตอนย่อ ชี้ไอคอนแล้วเห็นชื่อเมนูในทูลทิปธีม และไม่มี title ของเบราว์เซอร์', async () => {
    window.localStorage.setItem('admin:sidebar-collapsed', '1');
    renderLayout();
    const link = await screen.findByRole('link', { name: 'แดชบอร์ด' });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ขยายแถบเมนู' })).toBeInTheDocument();
    });
    expect(link).not.toHaveAttribute('title');
    fireEvent.pointerMove(link, { pointerType: 'mouse' });
    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent('แดชบอร์ด');
    expect(document.body.querySelector('[data-side]')?.className).toContain('bg-surface-raised');
  });

  it('ตอนขยาย เมนูที่อ่านได้ไม่มีทูลทิป', () => {
    renderLayout();
    const link = screen.getByRole('link', { name: 'แดชบอร์ด' });
    expect(link).not.toHaveAttribute('title');
    fireEvent.pointerMove(link, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
