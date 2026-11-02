import { pushMessage } from '@/lib/line/client';
import { decryptLineId } from '@/lib/line/identity';
import { getChatSetting } from '@/lib/line/settings';
import type { LineOutgoingMessage } from '@/lib/line/types';
import { formatThaiDateLong } from '@/lib/thai-date';

export type LineFlexMessage = Extract<LineOutgoingMessage, { type: 'flex' }>;
import {
  QUEUE_BOOKING_STATUS_LABELS,
  QUEUE_CATEGORY_LABELS,
  QUEUE_SLOT_LABELS,
  type QueueBookingStatus,
  type QueueCategory,
  type QueueSlotId,
} from '@/lib/validation';

export interface QueueBookingNotifyTarget {
  id: string;
  fullName: string;
  phoneNumber: string;
  category: QueueCategory;
  serviceType: string;
  bookingDate: string; // YYYY-MM-DD
  slot: string;
  note?: string | null;
  villageName?: string | null;
  lineUserIdEnc?: string | null;
}

const STATUS_HEADER_COLORS: Record<QueueBookingStatus, string> = {
  booked: '#1E40AF',
  confirmed: '#15803D',
  done: '#475569',
  cancelled: '#B91C1C',
};

function formatBookingDate(isoDate: string): string {
  return formatThaiDateLong(new Date(`${isoDate}T00:00:00`));
}

function resolveRawLineId(enc: string | null | undefined): string | null {
  if (!enc) return null;
  try {
    return decryptLineId(enc);
  } catch {
    return null;
  }
}

export function buildQueueConfirmationMessage(
  booking: QueueBookingNotifyTarget,
): LineFlexMessage {
  const dateTh = formatBookingDate(booking.bookingDate);
  const slotTh = QUEUE_SLOT_LABELS[booking.slot as QueueSlotId] ?? booking.slot;
  const categoryTh = QUEUE_CATEGORY_LABELS[booking.category] ?? booking.category;
  const locationTh =
    booking.category === 'technician'
      ? 'ลงพื้นที่ตรวจหน้างาน (เจ้าหน้าที่จะโทรประสานงานก่อนเข้าพื้นที่)'
      : 'ณ ที่ทำการ อบต.หัวงัว (กรุณาเตรียมบัตรประชาชนและเอกสารที่เกี่ยวข้อง)';

  const bodyContents: Record<string, unknown>[] = [
    { type: 'text', text: booking.serviceType, wrap: true, size: 'md', weight: 'bold' },
    { type: 'separator', margin: 'md' },
    {
      type: 'box',
      layout: 'horizontal',
      margin: 'md',
      contents: [
        { type: 'text', text: 'หมวดงาน', size: 'sm', color: '#6B7280', flex: 2 },
        { type: 'text', text: categoryTh, size: 'sm', wrap: true, flex: 5, weight: 'bold' },
      ],
    },
    {
      type: 'box',
      layout: 'horizontal',
      margin: 'sm',
      contents: [
        { type: 'text', text: 'วันที่นัด', size: 'sm', color: '#6B7280', flex: 2 },
        { type: 'text', text: dateTh, size: 'sm', wrap: true, flex: 5 },
      ],
    },
    {
      type: 'box',
      layout: 'horizontal',
      margin: 'sm',
      contents: [
        { type: 'text', text: 'ช่วงเวลา', size: 'sm', color: '#6B7280', flex: 2 },
        { type: 'text', text: slotTh, size: 'sm', wrap: true, flex: 5 },
      ],
    },
    {
      type: 'box',
      layout: 'horizontal',
      margin: 'sm',
      contents: [
        { type: 'text', text: 'สถานที่', size: 'sm', color: '#6B7280', flex: 2 },
        { type: 'text', text: locationTh, size: 'sm', wrap: true, flex: 5 },
      ],
    },
  ];

  if (booking.villageName) {
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      margin: 'sm',
      contents: [
        { type: 'text', text: 'หมู่บ้าน', size: 'sm', color: '#6B7280', flex: 2 },
        { type: 'text', text: booking.villageName, size: 'sm', wrap: true, flex: 5 },
      ],
    });
  }

  bodyContents.push(
    { type: 'separator', margin: 'lg' },
    {
      type: 'text',
      text: 'หากต้องการติดต่อสอบถามหรือยกเลิกคิว กรุณาติดต่อ อบต.หัวงัว โทร 043-750-000',
      wrap: true,
      size: 'xs',
      color: '#9CA3AF',
      margin: 'md',
    },
  );

  return {
    type: 'flex',
    altText: `ยืนยันการจองคิวนัดหมาย (อบต.หัวงัว): ${booking.serviceType} วันที่ ${dateTh}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: 'แจ้งยืนยันการจองคิวนัดหมาย', color: '#FFFFFF', size: 'md', weight: 'bold' },
          { type: 'text', text: 'อบต.หัวงัว อ.ยางตลาด จ.กาฬสินธุ์', color: '#E0E7FF', size: 'xs', margin: 'xs' },
        ],
        backgroundColor: '#1E40AF',
        paddingTop: 'md',
        paddingBottom: 'md',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: bodyContents,
      },
    },
  };
}

export function buildQueueStatusUpdateMessage(
  booking: QueueBookingNotifyTarget,
  newStatus: QueueBookingStatus,
  adminNote?: string | null,
): LineFlexMessage {
  const dateTh = formatBookingDate(booking.bookingDate);
  const slotTh = QUEUE_SLOT_LABELS[booking.slot as QueueSlotId] ?? booking.slot;
  const statusLabel = QUEUE_BOOKING_STATUS_LABELS[newStatus] ?? newStatus;
  const headerColor = STATUS_HEADER_COLORS[newStatus] ?? '#1E40AF';

  const bodyContents: Record<string, unknown>[] = [
    { type: 'text', text: booking.serviceType, wrap: true, size: 'md', weight: 'bold' },
    { type: 'separator', margin: 'md' },
    {
      type: 'box',
      layout: 'horizontal',
      margin: 'md',
      contents: [
        { type: 'text', text: 'สถานะนัดหมาย', size: 'sm', color: '#6B7280', flex: 3 },
        { type: 'text', text: statusLabel, size: 'sm', weight: 'bold', color: headerColor, flex: 4 },
      ],
    },
    {
      type: 'box',
      layout: 'horizontal',
      margin: 'sm',
      contents: [
        { type: 'text', text: 'วันที่นัด', size: 'sm', color: '#6B7280', flex: 3 },
        { type: 'text', text: dateTh, size: 'sm', flex: 4 },
      ],
    },
    {
      type: 'box',
      layout: 'horizontal',
      margin: 'sm',
      contents: [
        { type: 'text', text: 'ช่วงเวลา', size: 'sm', color: '#6B7280', flex: 3 },
        { type: 'text', text: slotTh, size: 'sm', flex: 4 },
      ],
    },
  ];

  if (newStatus === 'cancelled') {
    const reasonText = adminNote?.trim()
      ? `เหตุผลการยกเลิก: ${adminNote.trim()}`
      : 'เจ้าหน้าที่ได้ยกเลิกคิวนัดหมาย กรุณาติดต่อ อบต.หัวงัว หากต้องการสอบถามเพิ่มเติม';

    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      backgroundColor: '#FEF2F2',
      cornerRadius: 'md',
      paddingAll: 'sm',
      contents: [{ type: 'text', text: reasonText, wrap: true, size: 'xs', color: '#991B1B' }],
    });
  } else if (newStatus === 'confirmed') {
    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      backgroundColor: '#F0FDF4',
      cornerRadius: 'md',
      paddingAll: 'sm',
      contents: [
        {
          type: 'text',
          text: 'เจ้าหน้าที่ยืนยันนัดหมายเรียบร้อยแล้ว กรุณาเตรียมพร้อมตามวันและเวลาที่นัดหมาย',
          wrap: true,
          size: 'xs',
          color: '#166534',
        },
      ],
    });
  } else if (newStatus === 'done') {
    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      backgroundColor: '#F8FAFC',
      cornerRadius: 'md',
      paddingAll: 'sm',
      contents: [
        {
          type: 'text',
          text: 'ดำเนินการตามนัดหมายเสร็จสิ้นเรียบร้อย ขอบคุณที่ใช้บริการ อบต.หัวงัว',
          wrap: true,
          size: 'xs',
          color: '#334155',
        },
      ],
    });
  }

  bodyContents.push(
    { type: 'separator', margin: 'lg' },
    {
      type: 'text',
      text: 'สอบถามข้อมูลเพิ่มเติม โทร 043-750-000 (อบต.หัวงัว)',
      wrap: true,
      size: 'xs',
      color: '#9CA3AF',
      margin: 'md',
    },
  );

  return {
    type: 'flex',
    altText: `อัปเดตสถานะคิวนัดหมาย (อบต.หัวงัว): ${statusLabel} (${booking.serviceType})`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: 'อัปเดตสถานะคิวนัดหมาย', color: '#FFFFFF', size: 'md', weight: 'bold' },
          { type: 'text', text: `สถานะ: ${statusLabel}`, color: '#FFFFFF', size: 'xs', margin: 'xs' },
        ],
        backgroundColor: headerColor,
        paddingTop: 'md',
        paddingBottom: 'md',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: bodyContents,
      },
    },
  };
}

/**
 * ส่งข้อความยืนยันการจองคิวทาง LINE (Non-blocking / best-effort)
 */
export async function sendQueueBookingConfirmation(
  booking: QueueBookingNotifyTarget,
): Promise<boolean> {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) return false;
  if (!booking.lineUserIdEnc) return false;

  try {
    const enabled = await getChatSetting('line_notify_enabled');
    if (!enabled) return false;

    const rawLineId = resolveRawLineId(booking.lineUserIdEnc);
    if (!rawLineId) return false;

    const message = buildQueueConfirmationMessage(booking);
    await pushMessage(rawLineId, [message]);
    return true;
  } catch (err) {
    console.warn('[queue-booking-notify] failed to push confirmation', err);
    return false;
  }
}

/**
 * ส่งข้อความอัปเดตสถานะคิวทาง LINE (Non-blocking / best-effort)
 */
export async function sendQueueBookingStatusUpdate(
  booking: QueueBookingNotifyTarget,
  newStatus: QueueBookingStatus,
  adminNote?: string | null,
): Promise<boolean> {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) return false;
  if (!booking.lineUserIdEnc) return false;

  try {
    const enabled = await getChatSetting('line_notify_enabled');
    if (!enabled) return false;

    const rawLineId = resolveRawLineId(booking.lineUserIdEnc);
    if (!rawLineId) return false;

    const message = buildQueueStatusUpdateMessage(booking, newStatus, adminNote);
    await pushMessage(rawLineId, [message]);
    return true;
  } catch (err) {
    console.warn('[queue-booking-notify] failed to push status update', err);
    return false;
  }
}
