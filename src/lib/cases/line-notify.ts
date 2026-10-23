import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { cases, lineUsers } from '@/lib/db/schema';
import type { CaseStatus } from './state-machine';
import { consentActiveFor } from './citizen-access/consent-policy';
import { pushMessage } from '@/lib/line/client';
import { resolveRawLineId } from '@/lib/line/identity';
import { caseStatusFlex } from '@/lib/line/messages/flex';
import { getChatSetting } from '@/lib/line/settings';

// § best-effort หลัง commit เปลี่ยนสถานะ — ถ้าส่ง LINE ล้มเหลวหรือปิดสวิตช์ ห้ามทำให้การบันทึกสถานะล้ม
export async function notifyCitizenStatusChange(
  caseId: string,
  newStatus: CaseStatus,
): Promise<boolean> {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) return false;

  try {
    const enabled = await getChatSetting('line_notify_enabled');
    if (!enabled) return false;

    const db = await getDb();
    const row = await firstOrUndefined(
      db
        .select({
          trackingCode: cases.trackingCode,
          title: cases.title,
          lineUserPk: lineUsers.id,
        })
        .from(cases)
        .innerJoin(lineUsers, eq(lineUsers.linkedUserId, cases.submittedBy))
        .where(and(eq(cases.id, caseId), consentActiveFor(cases.submittedBy)))
        .limit(1),
    );
    if (!row?.trackingCode || !row.lineUserPk) return false;

    const rawLineId = await resolveRawLineId(db, row.lineUserPk);
    if (!rawLineId) return false;

    await pushMessage(rawLineId, [caseStatusFlex(row.trackingCode, newStatus, row.title)]);
    return true;
  } catch (err) {
    console.warn('[line-notify] failed to push case status notification', err);
    return false;
  }
}
