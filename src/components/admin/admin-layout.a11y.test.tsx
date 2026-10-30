// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 30_000 });

// A11Y-01: ทดสอบ drawer ผ่าน AdminLayout (mobileOpen=false + viewport มือถือ → aside มี inert)
const mockUseMediaQuery = vi.fn().mockReturnValue({ isDesktop: false, hydrated: true });

vi.mock('@/hooks/use-media-query', () => ({
  useMediaQuery: () => mockUseMediaQuery(),
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
    mockUseMediaQuery.mockReturnValue({ isDesktop: false, hydrated: true });
    render(
      <AdminLayout user={{ fullName: 'T', email: 't@x.go.th', role: 'superadmin' }} active="dashboard" title="T">
        <p>content</p>
      </AdminLayout>,
    );
    const aside = screen.getByRole('complementary', { hidden: true });
    expect(aside).toHaveAttribute('inert');
  });

  it('เปิดเมนู (mobileOpen=true) → aside ไม่มี inert, กด Escape ปิดเมนูและคืนโฟกัสให้ปุ่มเปิดเมนู', async () => {
    mockUseMediaQuery.mockReturnValue({ isDesktop: false, hydrated: true });
    const user = userEvent.setup();
    render(
      <AdminLayout user={{ fullName: 'T', email: 't@x.go.th', role: 'superadmin' }} active="dashboard" title="T">
        <p>content</p>
      </AdminLayout>,
    );

    const hamburger = screen.getByRole('button', { name: 'เปิดเมนู' });
    expect(hamburger).toHaveAttribute('aria-expanded', 'false');

    await user.click(hamburger);
    expect(hamburger).toHaveAttribute('aria-expanded', 'true');

    const aside = screen.getByRole('complementary');
    expect(aside).not.toHaveAttribute('inert');

    // กด Escape ปิดเมนู
    await user.keyboard('{Escape}');
    expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    expect(aside).toHaveAttribute('inert');
    expect(document.activeElement).toBe(hamburger);
  });

  it('เปิดเมนู → คลิกฉากหลัง (backdrop) ปิดเมนูและคืนโฟกัสให้ปุ่มเปิดเมนู', async () => {
    mockUseMediaQuery.mockReturnValue({ isDesktop: false, hydrated: true });
    const user = userEvent.setup();
    render(
      <AdminLayout user={{ fullName: 'T', email: 't@x.go.th', role: 'superadmin' }} active="dashboard" title="T">
        <p>content</p>
      </AdminLayout>,
    );

    const hamburger = screen.getByRole('button', { name: 'เปิดเมนู' });
    await user.click(hamburger);

    const closeButtons = screen.getAllByRole('button', { name: 'ปิดเมนู' });
    expect(closeButtons.length).toBe(2);
    // closeButtons[0] คือ backdrop
    await user.click(closeButtons[0]!);

    expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(hamburger);
  });

  it('viewport desktop (isDesktop=true) → aside ไม่มี inert แม้ mobileOpen=false', () => {
    mockUseMediaQuery.mockReturnValue({ isDesktop: true, hydrated: true });
    render(
      <AdminLayout user={{ fullName: 'T', email: 't@x.go.th', role: 'superadmin' }} active="dashboard" title="T">
        <p>content</p>
      </AdminLayout>,
    );

    const aside = screen.getByRole('complementary');
    expect(aside).not.toHaveAttribute('inert');
  });
});
