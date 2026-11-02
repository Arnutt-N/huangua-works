import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateQueueBooking } from './queue';
import { requireStaff } from '@/lib/auth/require-staff';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { sendQueueBookingStatusUpdate } from '@/lib/line/notify/queue-booking-notify';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaff: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
  AUDIT_ACTIONS: {
    QUEUE_BOOKING_UPDATE: 'queue_booking_update',
  },
}));

vi.mock('@/lib/line/notify/queue-booking-notify', () => ({
  sendQueueBookingStatusUpdate: vi.fn(),
}));

describe('updateQueueBooking server action', () => {
  const staffAuth = {
    user: { id: 'staff-1', role: 'admin' },
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  };

  const sampleBooking = {
    id: 'b-001',
    fullName: 'สมชาย ใจดี',
    phoneNumber: '0812345678',
    category: 'technician',
    serviceType: 'ไฟฟ้าสาธารณะดับ',
    bookingDate: '2026-11-15',
    slot: 'slot_1',
    status: 'booked',
    note: null,
    adminNote: null,
    lineUserIdEnc: 'enc-line-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireStaff).mockResolvedValue(staffAuth as any);
    vi.mocked(sendQueueBookingStatusUpdate).mockResolvedValue(true);
  });

  it('คืน error เมื่อข้อมูลฟอร์มไม่ถูกต้อง', async () => {
    const formData = new FormData();
    formData.append('id', 'not-a-valid-uuid');
    formData.append('status', 'invalid-status');

    const result = await updateQueueBooking({ error: null }, formData);
    expect(result.error).toBeDefined();
  });

  it('คืน error เมื่อไม่พบคิวในระบบ', async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const formData = new FormData();
    formData.append('id', '11111111-1111-4111-8111-111111111111');
    formData.append('status', 'confirmed');

    const result = await updateQueueBooking({ error: null }, formData);
    expect(result.error).toBe('ไม่พบคิวที่ระบุ');
  });

  it('คืน error เมื่อการเปลี่ยนสถานะผิดกฎ transition (เช่น booked -> done)', async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([sampleBooking]),
      }),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const formData = new FormData();
    formData.append('id', '11111111-1111-4111-8111-111111111111');
    formData.append('status', 'done'); // ไม่สามารถเปลี่ยนจาก booked ไป done ตรงๆ ได้

    const result = await updateQueueBooking({ error: null }, formData);
    expect(result.error).toContain('ไม่ได้');
  });

  it('อัปเดตสถานะสำเร็จ พร้อมเรียก LINE notification เมื่อมี lineUserIdEnc', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([sampleBooking]),
      }),
      update: mockUpdate,
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const formData = new FormData();
    formData.append('id', '11111111-1111-4111-8111-111111111111');
    formData.append('status', 'confirmed');
    formData.append('adminNote', 'ยืนยันรับเรื่องเรียบร้อย');

    const result = await updateQueueBooking({ error: null }, formData);
    expect(result.error).toBeNull();
    expect(result.success).toContain('ยืนยันแล้ว');
    expect(result.success).toContain('LINE');
    expect(mockUpdate).toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalled();
    expect(sendQueueBookingStatusUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b-001' }),
      'confirmed',
      'ยืนยันรับเรื่องเรียบร้อย',
    );
  });
});
