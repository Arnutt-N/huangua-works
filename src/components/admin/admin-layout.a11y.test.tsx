// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 30_000 });

// A11Y-01: ทดสอบ drawer ผ่าน AdminLayout (mobileOpen=false + viewport มือถือ → aside มี inert)
vi.mock('@/hooks/use-media-query', () => ({
  useMediaQuery: vi.fn().mockReturnValue({ isDesktop: false, hydrated: true }),
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

vi.mock('@/components/admin/admin-nav', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/admin/admin-nav')>();
  return { ...actual, visibleNavGroups: () => [] };
});

import { AdminLayout } from '@/components/admin/admin-layout';

afterEach(() => cleanup());

describe('A11Y-01 drawer', () => {
  it('mobileOpen=false + viewport มือถือ → aside มี inert, Tab ไม่เข้าเมนู', () => {
    render(
      <AdminLayout user={{ fullName: 'T', email: 't@x.go.th', role: 'superadmin' }} active="dashboard" title="T">
        <p>content</p>
      </AdminLayout>,
    );
    const aside = screen.getByRole('complementary', { hidden: true });
    expect(aside).toHaveAttribute('inert');
  });
});
