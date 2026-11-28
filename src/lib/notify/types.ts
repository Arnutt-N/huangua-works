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

/**
 * ผลการส่งของ channel เดียว — 'skipped' = env ไม่ครบ ไม่ถือว่าเป็นความผิดพลาด
 *
 * § retryable แยกความล้มเหลวชั่วคราว (5xx/429/network/timeout) จากถาวร (4xx)
 *   ให้ worker ตัดสินได้ว่าจะลองใหม่หรือไม่ — โดยไม่ต้อง parse ข้อความ error
 */
export interface NotifyChannelResult {
  status: NotifyDeliveryStatus;
  retryable?: boolean;
  error?: string;
}

export interface NotifyDelivery extends NotifyChannelResult {
  channel: NotifyChannel;
}
