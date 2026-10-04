import { sql, type AnyColumn, type SQL } from 'drizzle-orm';
import type { DbOrTx } from '../../db';
import { consentRecords } from '../../db/schema';
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

/**
 * กติกาเดียวของทุกช่องทาง (เว็บ / บอท / LIFF): ประชาชนเห็นเรื่องได้ก็ต่อเมื่อ record
 * data_collection ล่าสุดของเจ้าของเรื่องเป็นการให้ความยินยอม
 *
 * § ไม่มี record เลย = ไม่เห็น (ตรงกับ hasConsent เดิม) — ผู้แจ้งผ่านบอทก่อนมี
 * recordIntakeConsent จึงต้องรัน scripts/backfill-bot-consent.ts หลัง deploy
 * § "ล่าสุด" = ORDER BY created_at DESC, id DESC
 * generateId() คือ UUID v7 (timestamp-ordered, monotonic — src/lib/id.ts) จึงใช้เป็น
 * tie-break ของแถวที่เขียนคนละจังหวะได้ แต่สองแถวที่ created_at เท่ากันและ id ไม่เรียง
 * ตาม commit order ถือเป็น ambiguity ที่ยอมรับได้ (ไม่มี test ที่บังคับลำดับ commit
 * ข้าม connection) — มี test กรณี timestamp เท่ากันด้านล่าง
 * § grant ใหม่เป็นระดับ user ไม่ใช่ระดับเรื่อง — เจ้าของเดิมแจ้งเรื่องใหม่อีกครั้งหลังถอน
 * จะทำให้เรื่องเก่าทั้งหมดกลับมองเห็นได้ (ตั้งใจ เหมือนทางเว็บเดิม)
 * § เป็น correlated subquery ใน WHERE เดียวกับ lookup — "ไม่พบ" กับ "ถอนแล้ว"
 * จึงแยกกันไม่ออกจากภายนอก (กัน enumeration) และ list ไม่ต้องยิง N query
 */
export function consentActiveFor(ownerId: AnyColumn): SQL {
  return sql`coalesce((
    select ${consentRecords.isGranted}
    from ${consentRecords}
    where ${consentRecords.userId} = ${ownerId}
      and ${consentRecords.consentType} = 'data_collection'
    order by ${consentRecords.createdAt} desc, ${consentRecords.id} desc
    limit 1
  ), false)`;
}
