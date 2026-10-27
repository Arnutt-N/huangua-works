// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersClient } from './users-client';

// § เทสนี้รัน userEvent หลายขั้นภายใต้โหลดทั้งชุด timeout 5s ไม่พอ — 30s ตาม intake pattern
vi.setConfig({ testTimeout: 30_000 });

vi.mock('@/app/admin/actions/users', () => ({
  toggleUserActive: vi.fn(),
}));

import { toggleUserActive } from '@/app/admin/actions/users';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const MOCK_USERS = [
  {
    id: 'user-1',
    email: 'officer1@example.com',
    fullName: 'เจ้าหน้าที่ หนึ่ง',
    role: 'officer',
    departmentId: 'dept-1',
    departmentName: 'กองช่าง',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  },
  {
    id: 'user-2',
    email: 'officer2@example.com',
    fullName: 'เจ้าหน้าที่ สอง',
    role: 'officer',
    departmentId: 'dept-1',
    departmentName: 'กองช่าง',
    isActive: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  },
];

function renderClient() {
  return render(
    <UsersClient
      users={MOCK_USERS as never}
      departments={[{ id: 'dept-1', name: 'กองช่าง' }]}
      canResetPassword={true}
      currentUserId="admin-1"
      tierMatrix={null}
    />,
  );
}

// § ConfirmDialog description แบ่งข้อความเป็นหลาย nodes (ชื่อผู้ใช้คนละ element)
// ใช้ matcher แบบ function แทน regex ตรง ๆ — จำกัด tag <p> (DialogDescription) กัน match parent ซ้ำ
function dialogDescriptionMatcher(_content: string, element: Element | null) {
  if (element?.tagName !== 'P') return false;
  return element?.textContent?.includes('จะเข้าสู่ระบบไม่ได้') ?? false;
}

describe('UsersClient ระงับบัญชี', () => {
  it('กด "ระงับ" → เปิด ConfirmDialog, ยังไม่ส่ง action', async () => {
    const user = userEvent.setup();
    renderClient();

    await user.click(screen.getByRole('button', { name: 'ระงับบัญชี' }));

    expect(await screen.findByText(dialogDescriptionMatcher)).toBeInTheDocument();
    expect(toggleUserActive).not.toHaveBeenCalled();
  });

  it('กด "ยกเลิก" → ไม่เรียก action', async () => {
    const user = userEvent.setup();
    renderClient();

    await user.click(screen.getByRole('button', { name: 'ระงับบัญชี' }));
    await screen.findByText(dialogDescriptionMatcher);
    await user.click(screen.getByRole('button', { name: 'ยกเลิก' }));

    expect(toggleUserActive).not.toHaveBeenCalled();
  });

  it('action คืน error → แสดงใน FormError, dialog ปิด, ปุ่มกลับมากดได้', async () => {
    vi.mocked(toggleUserActive).mockResolvedValue({ error: 'ระงับไม่สำเร็จ' });
    const user = userEvent.setup();
    renderClient();

    await user.click(screen.getByRole('button', { name: 'ระงับบัญชี' }));
    await screen.findByText(dialogDescriptionMatcher);
    await user.click(screen.getByRole('button', { name: 'ยืนยัน' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('ระงับไม่สำเร็จ');
    });
    expect(screen.queryByText(dialogDescriptionMatcher)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ระงับบัญชี' })).not.toBeDisabled();
  });

  it('ระหว่าง pending → ปุ่มยืนยัน disabled + label "กำลังดำเนินการ..."', async () => {
    let resolveAction!: (v: { error: string | null }) => void;
    vi.mocked(toggleUserActive).mockReturnValue(
      new Promise((res) => {
        resolveAction = res;
      }),
    );
    const user = userEvent.setup();
    renderClient();

    await user.click(screen.getByRole('button', { name: 'ระงับบัญชี' }));
    await screen.findByText(dialogDescriptionMatcher);
    await user.click(screen.getByRole('button', { name: 'ยืนยัน' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'กำลังดำเนินการ...' })).toBeDisabled();
    });
    resolveAction({ error: null });
  });
});
