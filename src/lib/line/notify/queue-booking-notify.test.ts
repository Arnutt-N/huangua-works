import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildQueueConfirmationMessage,
  buildQueueStatusUpdateMessage,
  sendQueueBookingConfirmation,
  sendQueueBookingStatusUpdate,
  type QueueBookingNotifyTarget,
} from './queue-booking-notify';
import { pushMessage } from '@/lib/line/client';
import { decryptLineId } from '@/lib/line/identity';
import { getChatSetting } from '@/lib/line/settings';

vi.mock('@/lib/line/client', () => ({
  pushMessage: vi.fn(),
}));

vi.mock('@/lib/line/identity', () => ({
  decryptLineId: vi.fn(),
}));

vi.mock('@/lib/line/settings', () => ({
  getChatSetting: vi.fn(),
}));

describe('queue-booking-notify', () => {
  const sampleBooking: QueueBookingNotifyTarget = {
    id: 'book-01',
    fullName: 'สมชาย ใจดี',
    phoneNumber: '0812345678',
    category: 'technician',
    serviceType: 'ไฟฟ้าสาธารณะดับ',
    bookingDate: '2026-11-10',
    slot: 'slot_1',
    note: 'หน้าบ้าน',
    villageName: 'หมู่ 1 บ้านหัวงัว',
    lineUserIdEnc: 'encrypted-line-user-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-channel-token';
    vi.mocked(getChatSetting).mockResolvedValue(true);
    vi.mocked(decryptLineId).mockReturnValue('U1234567890abcdef');
    vi.mocked(pushMessage).mockResolvedValue(undefined);
  });

  describe('buildQueueConfirmationMessage', () => {
    it('สร้างข้อความยืนยันสำหรับหมวดช่าง (technician)', () => {
      const msg = buildQueueConfirmationMessage(sampleBooking);
      expect(msg.type).toBe('flex');
      expect(msg.altText).toContain('ยืนยันการจองคิวนัดหมาย');
      expect(msg.altText).toContain('ไฟฟ้าสาธารณะดับ');
      expect(JSON.stringify(msg)).toContain('ลงพื้นที่ตรวจหน้างาน');
      expect(JSON.stringify(msg)).toContain('หมู่ 1 บ้านหัวงัว');
    });

    it('สร้างข้อความยืนยันสำหรับหมวดราชการ (government)', () => {
      const govBooking: QueueBookingNotifyTarget = {
        ...sampleBooking,
        category: 'government',
        serviceType: 'ขออนุญาตก่อสร้างอาคาร',
        villageName: null,
      };
      const msg = buildQueueConfirmationMessage(govBooking);
      expect(msg.type).toBe('flex');
      expect(JSON.stringify(msg)).toContain('ณ ที่ทำการ อบต.หัวงัว');
      expect(JSON.stringify(msg)).toContain('งานติดต่อราชการทั่วไป');
    });
  });

  describe('buildQueueStatusUpdateMessage', () => {
    it('สร้างข้อความอัปเดตสถานะยืนยันแล้ว', () => {
      const msg = buildQueueStatusUpdateMessage(sampleBooking, 'confirmed');
      expect(msg.type).toBe('flex');
      expect(msg.altText).toContain('ยืนยันแล้ว');
      expect(JSON.stringify(msg)).toContain('เจ้าหน้าที่ยืนยันนัดหมายเรียบร้อยแล้ว');
    });

    it('สร้างข้อความอัปเดตสถานะเสร็จสิ้น', () => {
      const msg = buildQueueStatusUpdateMessage(sampleBooking, 'done');
      expect(msg.type).toBe('flex');
      expect(msg.altText).toContain('เสร็จแล้ว');
      expect(JSON.stringify(msg)).toContain('ดำเนินการตามนัดหมายเสร็จสิ้นเรียบร้อย');
    });

    it('สร้างข้อความอัปเดตสถานะยกเลิกพร้อมเหตุผล', () => {
      const msg = buildQueueStatusUpdateMessage(sampleBooking, 'cancelled', 'ติดภารกิจด่วน');
      expect(msg.type).toBe('flex');
      expect(msg.altText).toContain('ยกเลิกแล้ว');
      expect(JSON.stringify(msg)).toContain('เหตุผลการยกเลิก: ติดภารกิจด่วน');
    });

    it('สร้างข้อความอัปเดตสถานะยกเลิกเมื่อไม่มีเหตุผล', () => {
      const msg = buildQueueStatusUpdateMessage(sampleBooking, 'cancelled', null);
      expect(msg.type).toBe('flex');
      expect(JSON.stringify(msg)).toContain('เจ้าหน้าที่ได้ยกเลิกคิวนัดหมาย');
    });
  });

  describe('sendQueueBookingConfirmation', () => {
    it('ส่ง push สำเร็จเมื่อ config และ token ครบถ้วน', () => {
      return expect(sendQueueBookingConfirmation(sampleBooking)).resolves.toBe(true).then(() => {
        expect(pushMessage).toHaveBeenCalledWith('U1234567890abcdef', expect.any(Array));
      });
    });

    it('คืน false เมื่อไม่มี LINE_CHANNEL_ACCESS_TOKEN', async () => {
      delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
      const res = await sendQueueBookingConfirmation(sampleBooking);
      expect(res).toBe(false);
      expect(pushMessage).not.toHaveBeenCalled();
    });

    it('คืน false เมื่อ lineUserIdEnc เป็น null', async () => {
      const res = await sendQueueBookingConfirmation({ ...sampleBooking, lineUserIdEnc: null });
      expect(res).toBe(false);
      expect(pushMessage).not.toHaveBeenCalled();
    });

    it('คืน false เมื่อ line_notify_enabled ปิดอยู่', async () => {
      vi.mocked(getChatSetting).mockResolvedValue(false);
      const res = await sendQueueBookingConfirmation(sampleBooking);
      expect(res).toBe(false);
      expect(pushMessage).not.toHaveBeenCalled();
    });

    it('คืน false เมื่อถอดรหัส lineUserIdEnc ไม่สำเร็จ', async () => {
      vi.mocked(decryptLineId).mockImplementation(() => {
        throw new Error('decryption failed');
      });
      const res = await sendQueueBookingConfirmation(sampleBooking);
      expect(res).toBe(false);
      expect(pushMessage).not.toHaveBeenCalled();
    });

    it('คืน false และไม่ throw เมื่อ pushMessage เกิด error', async () => {
      vi.mocked(pushMessage).mockRejectedValue(new Error('LINE API 500'));
      const res = await sendQueueBookingConfirmation(sampleBooking);
      expect(res).toBe(false);
    });
  });

  describe('sendQueueBookingStatusUpdate', () => {
    it('ส่ง push อัปเดตสถานะสำเร็จ', async () => {
      const res = await sendQueueBookingStatusUpdate(sampleBooking, 'confirmed');
      expect(res).toBe(true);
      expect(pushMessage).toHaveBeenCalledWith('U1234567890abcdef', expect.any(Array));
    });

    it('คืน false และไม่ throw เมื่อ pushMessage เกิด error', async () => {
      vi.mocked(pushMessage).mockRejectedValue(new Error('LINE API 400 user blocked'));
      const res = await sendQueueBookingStatusUpdate(sampleBooking, 'cancelled', 'ยกเลิก');
      expect(res).toBe(false);
    });
  });
});
