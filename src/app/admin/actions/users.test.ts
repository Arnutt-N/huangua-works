import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createUser,
  toggleUserActive,
  updateUserRole,
  resetPassword,
} from './users';
import * as requireStaffModule from '@/lib/auth/require-staff';
import * as dbModule from '@/lib/db';
import * as auditModule from '@/lib/audit';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('Users Server Actions Error Handling', () => {
  beforeEach(() => {
    vi.spyOn(requireStaffModule, 'requireStaff').mockResolvedValue({
      user: {
        id: 'admin-1',
        fullName: 'แอดมิน ทดสอบ',
        email: 'admin@test.local',
        role: 'superadmin',
      },
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    } as unknown as Awaited<ReturnType<typeof requireStaffModule.requireStaff>>);

    vi.spyOn(auditModule, 'logAudit').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('createUser คืนข้อผิดพลาดอย่างปลอดภัยเมื่อเช็คอีเมลล้มเหลว', async () => {
    vi.spyOn(dbModule, 'getDb').mockRejectedValue(new Error('DB failure'));

    const formData = new FormData();
    formData.append('email', 'officer1@example.com');
    formData.append('fullName', 'เจ้าหน้าที่ ทดสอบ');
    formData.append('role', 'officer');
    formData.append('password', 'ValidPassw0rd!');

    const res = await createUser({ error: null }, formData);
    expect(res.error).toBe('เกิดข้อผิดพลาดในการตรวจสอบข้อมูลผู้ใช้');
  });

  it('toggleUserActive คืนข้อผิดพลาดอย่างปลอดภัยเมื่อค้นหาผู้ใช้ล้มเหลว', async () => {
    vi.spyOn(dbModule, 'getDb').mockRejectedValue(new Error('DB failure'));

    const formData = new FormData();
    formData.append('userId', 'target-user-1');

    const res = await toggleUserActive({ error: null }, formData);
    expect(res.error).toBe('เกิดข้อผิดพลาดในการตรวจสอบข้อมูลผู้ใช้');
  });

  it('updateUserRole คืนข้อผิดพลาดอย่างปลอดภัยเมื่อค้นหาผู้ใช้ล้มเหลว', async () => {
    vi.spyOn(dbModule, 'getDb').mockRejectedValue(new Error('DB failure'));

    const formData = new FormData();
    formData.append('userId', 'target-user-1');
    formData.append('role', 'officer');

    const res = await updateUserRole({ error: null }, formData);
    expect(res.error).toBe('เกิดข้อผิดพลาดในการตรวจสอบข้อมูลผู้ใช้');
  });

  it('resetPassword คืนข้อผิดพลาดอย่างปลอดภัยเมื่อค้นหาผู้ใช้ล้มเหลว', async () => {
    vi.spyOn(dbModule, 'getDb').mockRejectedValue(new Error('DB failure'));

    const formData = new FormData();
    formData.append('userId', 'target-user-1');
    formData.append('newPassword', 'NewValidPassw0rd!');

    const res = await resetPassword({ error: null }, formData);
    expect(res.error).toBe('เกิดข้อผิดพลาดในการตรวจสอบข้อมูลผู้ใช้');
  });
});
