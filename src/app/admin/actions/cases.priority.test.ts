import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setPriority } from './cases';
import { requireStaff } from '@/lib/auth/require-staff';
import { applyCaseUpdate } from '@/lib/cases/operations';
import { getDb } from '@/lib/db';
import { notifyUrgentCase } from '@/lib/notify';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaff: vi.fn(),
}));

vi.mock('@/lib/cases/operations', () => ({
  applyCaseUpdate: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/notify', () => ({
  notifyUrgentCase: vi.fn().mockResolvedValue([]),
}));

describe('setPriority server action', () => {
  const staffAuth = {
    user: { id: 'staff-1', role: 'admin' },
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireStaff).mockResolvedValue(staffAuth as any);
  });

  it('คืน error เมื่อข้อมูลฟอร์มไม่ถูกต้อง', async () => {
    const fd = new FormData();
    fd.set('caseId', '');
    fd.set('priority', 'invalid-priority');

    const result = await setPriority({ error: null }, fd);
    expect(result.error).toBeTruthy();
  });

  it('ปรับเป็น urgent สำเร็จ พร้อมเรียก notifyUrgentCase', async () => {
    vi.mocked(applyCaseUpdate).mockResolvedValue({ ok: true } as any);

    const queryBuilder: any = {};
    queryBuilder.leftJoin = vi.fn().mockReturnValue(queryBuilder);
    queryBuilder.where = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([
        {
          trackingCode: 'HG-691103001',
          title: 'เสาไฟฟ้าล้มขวางทาง',
          categoryName: 'ไฟฟ้าสาธารณะ',
          assignedToName: 'สมชาย ช่างไฟ',
        },
      ]),
    });

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue(queryBuilder),
    });
    vi.mocked(getDb).mockResolvedValue({ select: mockSelect } as any);

    const fd = new FormData();
    fd.set('caseId', 'case-123');
    fd.set('priority', 'urgent');

    const result = await setPriority({ error: null }, fd);
    expect(result.error).toBeNull();
    expect(result.success).toContain('เรียบร้อย');
    expect(applyCaseUpdate).toHaveBeenCalledWith(
      'case-123',
      { kind: 'priority', priority: 'urgent' },
      expect.objectContaining({ userId: 'staff-1' }),
    );
    await vi.waitFor(() => {
      expect(notifyUrgentCase).toHaveBeenCalledWith({
        trackingCode: 'HG-691103001',
        title: 'เสาไฟฟ้าล้มขวางทาง',
        categoryName: 'ไฟฟ้าสาธารณะ',
        assignedToName: 'สมชาย ช่างไฟ',
      });
    });
  });

  it('ปรับเป็น normal สำเร็จ และไม่เรียก notifyUrgentCase', async () => {
    vi.mocked(applyCaseUpdate).mockResolvedValue({ ok: true } as any);

    const fd = new FormData();
    fd.set('caseId', 'case-123');
    fd.set('priority', 'normal');

    const result = await setPriority({ error: null }, fd);
    expect(result.error).toBeNull();
    expect(result.success).toContain('เรียบร้อย');
    expect(notifyUrgentCase).not.toHaveBeenCalled();
  });
});
