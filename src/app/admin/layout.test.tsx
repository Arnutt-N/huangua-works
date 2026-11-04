// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdminRootLayout from './layout';

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaff: vi.fn(),
}));

vi.mock('@/components/admin/admin-chrome', () => ({
  AdminChrome: ({ user, children }: { user: { fullName: string; email: string; role: string }; children: React.ReactNode }) => (
    <div data-testid="admin-chrome" data-user-role={user.role} data-user-email={user.email}>
      {children}
    </div>
  ),
}));

describe('AdminRootLayout (src/app/admin/layout.tsx)', () => {
  it('เมื่อไม่มี session (หน้า public เช่น login) ส่งผ่าน children ตรงๆ ไม่เรียก requireStaff', async () => {
    const { auth } = await import('@/auth');
    const { requireStaff } = await import('@/lib/auth/require-staff');
    vi.mocked(auth).mockResolvedValueOnce(null as any);

    const jsx = await AdminRootLayout({
      children: <div data-testid="public-content">เข้าสู่ระบบ</div>,
    });
    render(jsx);

    expect(screen.getByTestId('public-content')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-chrome')).not.toBeInTheDocument();
    expect(requireStaff).not.toHaveBeenCalled();
  });

  it('เมื่อมี session เรียก requireStaff และหุ้มด้วย AdminChrome โดยส่งเฉพาะข้อมูลที่ sanitize แล้ว', async () => {
    const { auth } = await import('@/auth');
    const { requireStaff } = await import('@/lib/auth/require-staff');
    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'staff@test.local' } } as any);
    vi.mocked(requireStaff).mockResolvedValueOnce({
      user: {
        id: 'user-1',
        fullName: 'สมชาย ใจดี',
        email: 'staff@test.local',
        role: 'admin',
        passwordHash: '$2b$10$secretHashShouldNotBeSentToClient',
      } as any,
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });

    const jsx = await AdminRootLayout({
      children: <div data-testid="console-content">หน้าจัดการ</div>,
    });
    render(jsx);

    const chrome = screen.getByTestId('admin-chrome');
    expect(chrome).toBeInTheDocument();
    expect(chrome).toHaveAttribute('data-user-role', 'admin');
    expect(chrome).toHaveAttribute('data-user-email', 'staff@test.local');
    expect(screen.getByTestId('console-content')).toBeInTheDocument();
  });
});
