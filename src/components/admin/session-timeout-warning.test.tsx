// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 30_000 });

const mockState = {
  showWarning: true,
  remainingSeconds: 120,
  restartIdleTimer: vi.fn(),
};

vi.mock('@/hooks/use-session-timeout', () => ({
  useSessionTimeout: () => mockState,
}));

vi.mock('@/app/admin/actions', () => ({
  logout: vi.fn().mockResolvedValue(undefined),
}));

import { SessionTimeoutWarning } from './session-timeout-warning';

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  mockState.showWarning = true;
});

describe('A11Y-04 session warning', () => {
  it('ข้อความไทยทั้งหมด + aria-describedby', () => {
    render(<SessionTimeoutWarning />);
    expect(screen.getByText('เซสชันกำลังจะหมดอายุ')).toBeInTheDocument();
    expect(screen.getByText('ใช้งานต่อ')).toBeInTheDocument();
    expect(screen.getByText('ออกจากระบบ')).toBeInTheDocument();
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-describedby', 'session-timeout-desc');
    // ไม่มีอังกฤษใน title/description
    expect(screen.queryByText(/Session Expiring Soon/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Continue/)).not.toBeInTheDocument();
  });

  it('mount → focus อยู่ใน dialog; Tab วนใน dialog', async () => {
    const user = userEvent.setup();
    render(<SessionTimeoutWarning />);
    const dialog = screen.getByRole('alertdialog');
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
    // Tab จากปุ่มสุดท้ายวนกลับปุ่มแรก
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(2);
    buttons[1]!.focus();
    await user.tab();
    await waitFor(() => {
      expect(document.activeElement).toBe(buttons[0]);
    });
  });
});
