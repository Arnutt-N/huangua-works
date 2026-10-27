// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 30_000 });

import AdminError from './error';

afterEach(() => cleanup());

describe('src/app/admin/error.tsx', () => {
  it('mock reset() → เรียกได้; ข้อความไทย; ปุ่ม "ลองใหม่" + "กลับแดชบอร์ด"', async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<AdminError error={new Error('boom')} reset={reset} />);

    expect(screen.getByText('เกิดข้อผิดพลาด')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ลองใหม่' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'กลับแดชบอร์ด' })).toHaveAttribute('href', '/admin');

    await user.click(screen.getByRole('button', { name: 'ลองใหม่' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
