import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  saveDepartment,
  saveCategory,
  toggleActive,
  deleteDepartment,
} from './master-data';
import * as requireStaffModule from '@/lib/auth/require-staff';
import * as dbModule from '@/lib/db';
import * as auditModule from '@/lib/audit';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Master Data Server Actions Error Handling', () => {
  beforeEach(() => {
    vi.spyOn(requireStaffModule, 'requireStaff').mockResolvedValue({
      user: {
        id: 'admin-1',
        fullName: 'แอดมิน ทดสอบ',
        email: 'admin@test.local',
        role: 'head',
      },
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    } as unknown as Awaited<ReturnType<typeof requireStaffModule.requireStaff>>);

    vi.spyOn(auditModule, 'logAudit').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saveDepartment คืนข้อผิดพลาดอย่างปลอดภัยเมื่อฐานข้อมูลล้มเหลว', async () => {
    vi.spyOn(dbModule, 'getDb').mockRejectedValue(new Error('DB failure'));

    const formData = new FormData();
    formData.append('name', 'กองช่าง');
    formData.append('slug', 'engineering');

    const res = await saveDepartment({ error: null }, formData);
    expect(res.error).toBe('บันทึกไม่สำเร็จ กรุณาลองใหม่');
  });

  it('saveCategory คืนข้อผิดพลาดอย่างปลอดภัยเมื่อฐานข้อมูลล้มเหลว', async () => {
    vi.spyOn(dbModule, 'getDb').mockRejectedValue(new Error('DB failure'));

    const formData = new FormData();
    formData.append('name', 'ถนนชำรุด');
    formData.append('slug', 'road');
    formData.append('estimatedDays', '3');

    const res = await saveCategory({ error: null }, formData);
    expect(res.error).toBe('บันทึกไม่สำเร็จ กรุณาลองใหม่');
  });

  it('toggleActive คืนข้อผิดพลาดอย่างปลอดภัยเมื่อฐานข้อมูลล้มเหลว', async () => {
    vi.spyOn(dbModule, 'getDb').mockRejectedValue(new Error('DB failure'));

    const formData = new FormData();
    formData.append('id', 'dept-1');
    formData.append('kind', 'department');

    const res = await toggleActive({ error: null }, formData);
    expect(res.error).toBe('สลับสถานะไม่สำเร็จ กรุณาลองใหม่');
  });

  it('deleteDepartment คืนข้อผิดพลาดอย่างปลอดภัยเมื่อฐานข้อมูลล้มเหลว', async () => {
    vi.spyOn(dbModule, 'getDb').mockRejectedValue(new Error('DB failure'));

    const formData = new FormData();
    formData.append('id', 'dept-1');

    const res = await deleteDepartment({ error: null }, formData);
    expect(res.error).toBe('ลบข้อมูลไม่สำเร็จ กรุณาลองใหม่');
  });
});
