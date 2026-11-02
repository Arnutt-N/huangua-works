import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import { getDb } from '@/lib/db';
import { checkRateLimit } from '@/lib/upstash';
import { logAudit } from '@/lib/audit';
import { toLocalISODate } from '@/lib/validation';
import { LIFF_SESSION_COOKIE, createLiffSessionValue } from '@/lib/liff/session';
import { sendQueueBookingConfirmation } from '@/lib/line/notify/queue-booking-notify';

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/upstash', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
  AUDIT_ACTIONS: {
    QUEUE_BOOKING_CREATE: 'queue_booking_create',
  },
}));

vi.mock('@/lib/line/notify/queue-booking-notify', () => ({
  sendQueueBookingConfirmation: vi.fn(),
}));

function nextBusinessDay(): string {
  const d = new Date();
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return toLocalISODate(d);
}

describe('GET /api/queue', () => {
  const validDate = nextBusinessDay();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('คืน 400 เมื่อไม่มี date หรือ date ไม่ถูกต้อง', async () => {
    const req = new NextRequest('http://localhost:3000/api/queue');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('คืนรายการช่วงเวลาว่างแยกตาม category เมื่อ date ถูกต้อง', async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ slot: 'slot_1' }]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const req = new NextRequest(`http://localhost:3000/api/queue?date=${validDate}&category=government`);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.category).toBe('government');
    expect(data.date).toBe(validDate);
    expect(data.slots).toHaveLength(4);
    expect(data.slots.find((s: any) => s.id === 'slot_1').available).toBe(false);
    expect(data.slots.find((s: any) => s.id === 'slot_2').available).toBe(true);
  });
});

describe('POST /api/queue', () => {
  const validDate = nextBusinessDay();
  const validPayload = {
    fullName: 'สมชาย ใจดี',
    phoneNumber: '0812345678',
    category: 'technician',
    serviceType: 'ไฟฟ้าสาธารณะดับ',
    note: 'เสาหน้าบ้าน',
    villageId: 'v-01',
    bookingDate: validDate,
    slot: 'slot_1',
    consent: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CID_HMAC_KEY = 'mock-cid-hmac-key-minimum-32-chars-long';
    process.env.LINE_ID_HMAC_KEY = 'mock-line-id-key-minimum-32-chars-long';
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 10, reset: 0 });
    vi.mocked(sendQueueBookingConfirmation).mockResolvedValue(true);
  });

  it('คืน 429 เมื่อถูกจำกัดอัตราคำขอ (rate limit)', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, reset: 120 });
    const req = new NextRequest('http://localhost:3000/api/queue', {
      method: 'POST',
      body: JSON.stringify(validPayload),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it('คืน 400 เมื่อ payload ขาด consent หรือข้อมูลไม่ครบ', async () => {
    const req = new NextRequest('http://localhost:3000/api/queue', {
      method: 'POST',
      body: JSON.stringify({ ...validPayload, consent: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('คืน 429 เมื่อเบอร์โทรศัพท์มีคิวค้างอยู่แล้ว 2 รายการขึ้นไป', async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 2 }]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const req = new NextRequest('http://localhost:3000/api/queue', {
      method: 'POST',
      body: JSON.stringify(validPayload),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toContain('เกิน 2 รายการ');
  });

  it('คืน 409 เมื่อช่วงเวลาในหมวดหมู่นั้นถูกจองแล้ว (pre-check collision)', async () => {
    let callCount = 0;
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // activeCount check
          return Promise.resolve([{ count: 0 }]);
        }
        // pre-check collision
        return {
          limit: vi.fn().mockResolvedValue([{ id: 'existing-booking' }]),
        };
      }),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const req = new NextRequest('http://localhost:3000/api/queue', {
      method: 'POST',
      body: JSON.stringify(validPayload),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain('ถูกจองแล้ว');
  });

  it('บันทึกการจองสำเร็จ พร้อมส่ง LINE notification หากมี LIFF session cookie', async () => {
    let callCount = 0;
    const mockInsert = vi.fn().mockResolvedValue(undefined);
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // activeCount
          return Promise.resolve([{ count: 0 }]);
        }
        if (callCount === 2) {
          // existing slot collision check
          return {
            limit: vi.fn().mockResolvedValue([]),
          };
        }
        // village name lookup
        return {
          limit: vi.fn().mockResolvedValue([{ name: 'บ้านหัวงัว หมู่ 1' }]),
        };
      }),
      insert: vi.fn().mockReturnValue({ values: mockInsert }),
      update: mockUpdate,
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const cookieVal = createLiffSessionValue('Utestuser123');
    const req = new NextRequest('http://localhost:3000/api/queue', {
      method: 'POST',
      body: JSON.stringify(validPayload),
      headers: {
        'Content-Type': 'application/json',
        cookie: `${LIFF_SESSION_COOKIE}=${cookieVal}`,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.booking.hasLineNotification).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: 'สมชาย ใจดี',
        category: 'technician',
        lineNotificationStatus: 'pending',
      }),
    );
    expect(logAudit).toHaveBeenCalled();
  });
});
