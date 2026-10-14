/**
 * Notification abstraction — ชนิดข้อมูลกลางของทุก channel
 *
 * § channel ใหม่เพิ่มใน NotifyChannel แล้วทำ send function ในไฟล์ของตัวเอง
 * index.ts จะ fan-out ให้อัตโนมัติ
 */

export type NotifyChannel = 'telegram' | 'discord';

export interface NotifyPayload {
  subject: string;
  message: string;
}

export type NotifyDeliveryStatus = 'sent' | 'skipped' | 'failed';

/** ผลการส่งของ channel เดียว — 'skipped' = env ไม่ครบ ไม่ถือว่าเป็นความผิดพลาด */
export interface NotifyChannelResult {
  status: NotifyDeliveryStatus;
  error?: string;
}

export interface NotifyDelivery extends NotifyChannelResult {
  channel: NotifyChannel;
}
