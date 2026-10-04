import type { DbOrTx } from '../../db';
import { grantConsent, CONSENT_VERSION } from '../../consent';

/** ช่องทางที่ให้ความยินยอมตอนแจ้งเรื่องใหม่ — เก็บใน consent_records.metadata.via */
export type IntakeConsentVia = 'intake_submit' | 'liff_submit' | 'line_bot_submit';

/**
 * บันทึกความยินยอม data_collection ตอนแจ้งเรื่องใหม่
 *
 * § เว็บ/LIFF ติ๊ก checkbox, บอทถือว่าการพิมพ์ "ยืนยัน" หลังข้อความแจ้ง
 * (BOT_CONSENT_NOTICE ใน line/bot/case-flow.ts) = ยินยอม — ถ้าข้อความนั้นหายไป
 * การบันทึก via line_bot_submit จะไม่มีฐานรองรับ
 */
export async function recordIntakeConsent(
  userId: string,
  via: IntakeConsentVia,
  ctx: { ipAddress?: string; userAgent?: string } = {},
  db?: DbOrTx,
): Promise<void> {
  await grantConsent(
    {
      userId,
      consentType: 'data_collection',
      version: CONSENT_VERSION,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { via },
    },
    db,
  );
}
