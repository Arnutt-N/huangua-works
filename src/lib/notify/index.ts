import { sendTelegram } from './telegram';
import { sendDiscord } from './discord';
import type { NotifyDelivery, NotifyPayload } from './types';

export type {
  NotifyChannel,
  NotifyPayload,
  NotifyDelivery,
  NotifyDeliveryStatus,
  NotifyChannelResult,
} from './types';
export { sendTelegram } from './telegram';
export { sendDiscord } from './discord';

/**
 * ส่งการแจ้งเตือนไปทุก channel ที่ตั้งค่า env ไว้ (fail-open)
 *
 * § สัญญา fail-open: ไม่มีวัน throw — channel ที่ env ไม่ครบได้ 'skipped'
 * channel ที่ส่งพังได้ 'failed' — ผู้เรียกดูผลลัพธ์ต่อได้โดย flow หลักไม่พัง
 *
 * § กัน unit test ของโมดูลอื่น (เช่น intake.test.ts) ยิง API จริง: vitest.setup โหลด
 * .env.local เข้า process.env — ถ้าเครื่อง dev ตั้ง token จริงไว้ เคส success path
 * ของ createCase จะยิง Telegram/Discord จริงทุกครั้งที่รัน unit test
 * จึงปิดการส่งทั้งหมดเมื่อ NODE_ENV=test เว้นแต่ตั้ง NOTIFY_ENABLE_IN_TEST=true
 * (ใช้ใน notify.test.ts ที่ stub fetch แล้วเท่านั้น — ไม่ใช่ค่าสำหรับ operator)
 */
export async function sendNotification(payload: NotifyPayload): Promise<NotifyDelivery[]> {
  const channels = [
    { channel: 'telegram', send: sendTelegram },
    { channel: 'discord', send: sendDiscord },
  ] as const;

  if (process.env.NODE_ENV === 'test' && process.env.NOTIFY_ENABLE_IN_TEST !== 'true') {
    return channels.map(({ channel }) => ({ channel, status: 'skipped' as const }));
  }

  const text = [payload.subject, payload.message].filter(Boolean).join('\n\n');

  return Promise.all(
    channels.map(async ({ channel, send }): Promise<NotifyDelivery> => {
      try {
        return { channel, ...(await send(text)) };
      } catch (error) {
        return {
          channel,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
}

export interface NewCaseNotice {
  trackingCode: string;
  title: string;
  categoryName: string;
  channel: 'web' | 'line';
  location?: string;
}

/** ข้อความแจ้งเรื่องใหม่ — ภาษาไทย ไม่ใส่ข้อมูลผู้แจ้ง (PDPA) */
export function buildNewCaseNoticeText(notice: NewCaseNotice): string {
  return [
    `หัวข้อ: ${notice.title}`,
    `เลขอ้างอิง: ${notice.trackingCode}`,
    `หมวดหมู่: ${notice.categoryName}`,
    `ช่องทาง: ${notice.channel === 'web' ? 'เว็บไซต์' : 'LINE'}`,
    `สถานที่: ${notice.location?.trim() || '-'}`,
  ].join('\n');
}

/**
 * แจ้งเจ้าหน้าที่เมื่อรับเรื่องร้องเรียนใหม่ — fail-open เหมือน sendNotification
 */
export async function notifyNewCase(notice: NewCaseNotice): Promise<NotifyDelivery[]> {
  try {
    return await sendNotification({
      subject: 'เรื่องร้องเรียนใหม่',
      message: buildNewCaseNoticeText(notice),
    });
  } catch (error) {
    console.warn('[notify] new-case notice failed', error);
    return [];
  }
}
