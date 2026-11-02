import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addResponsible,
  updateResponsible,
  toggleResponsibleActive,
  deleteResponsible,
} from './responsible';
import * as requireStaffModule from '@/lib/auth/require-staff';
import * as dbModule from '@/lib/db';
import * as auditModule from '@/lib/audit';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Responsible Server Actions Error Handling', () => {
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

  it('addResponsible คืนข้อผิดพลาดอย่างปลอดภัยเมื่อฐานข้อมูลล้มเหลว', async () => {
    vi.spyOn(dbModule, 'getDb').mockRejectedValue(new Error('DB connection lost'));

    const formData = new FormData();
    formData.append('raw', 'งานซ่อมบำรุง');
    formData.append('departmentId', '00000000-0000-0000-0000-000000000001');

    const res = await addResponsible({ error: null }, formData);
    expect(res.error).toBe('เกิดข้อผิดพลาดในการตรวจสอบหน่วยงาน');
  });

  it('updateResponsible คืนข้อผิดพลาดอย่างปลอดภัยเมื่อฐานข้อมูลล้มเหลว', async () => {
    vi.spyOn(dbModule, 'getDb').mockRejectedValue(new Error('DB query error'));

    const formData = new FormData();
    formData.append('raw', 'งานซ่อมบำรุง');
    formData.append('departmentId', '00000000-0000-0000-0000-000000000001');

    const res = await updateResponsible({ error: null }, formData);
    expect(res.error).toBe('ไม่พบ mapping นี้');
  });

  it('toggleResponsibleActive คืนข้อผิดพลาดอย่างปลอดภัยเมื่อฐานข้อมูลล้มเหลว', async () => {
    vi.spyOn(dbModule, 'getDb').mockRejectedValue(new Error('DB failure'));

    const formData = new FormData();
    formData.append('raw', 'งานซ่อมบำรุง');

    const res = await toggleResponsibleActive({ error: null }, formData);
    expect(res.error).toBe('ไม่พบ mapping นี้');
  });

  it('deleteResponsible คืนข้อผิดพลาดอย่างปลอดภัยเมื่อฐานข้อมูลล้มเหลว', async () => {
    vi.spyOn(dbModule, 'getDb').mockRejectedValue(new Error('DB connection drop'));

    const formData = new FormData();
    formData.append('raw', 'งานซ่อมบำรุง');

    const res = await deleteResponsible({ error: null }, formData);
    expect(res.error).toBe('ไม่พบ mapping นี้');
  });
});
