import { and, eq } from 'drizzle-orm';
import { getDb, type DbOrTx } from '../../db';
import { firstOrUndefined } from '../../db/query-helpers';
import { cases, lineUsers, users } from '../../db/schema';
import { AUDIT_ACTIONS, logAudit } from '../../audit';
import { normalizeTrackingCode } from '../../case-tracking';
import { revokeConsentWithAudit } from '../../consent';
import { cidPlaceholderEmail } from './identity';

/**
 * หลักฐานความเป็นเจ้าของเรื่อง
 * - cid: ผู้แจ้งทางเว็บ — CID ต้องตรงกับ placeholder ของเจ้าของเรื่อง
 * - line: ผู้แจ้งผ่าน LINE (บอท/LIFF ไม่มี CID ในระบบ) — lineUserId จาก LIFF session
 *   cookie ที่ server sign ต้องผูกกับเจ้าของเรื่อง
 */
export type OwnershipProof = { kind: 'cid'; cid: string } | { kind: 'line'; lineUserId: string };

/** § ไม่บอกเหตุผลที่ปฏิเสธ — "ไม่พบ" กับ "ไม่ใช่เจ้าของ" ต้องแยกกันไม่ออก (กัน enumeration) */
export type WithdrawResult = { ok: true } | { ok: false };

type DenialReason = 'cid_mismatch' | 'submitter_missing' | 'not_case_owner_line';

const DENIED: WithdrawResult = { ok: false };

export async function withdrawCaseConsent(
  rawCode: string,
  proof: OwnershipProof,
  ctx: { ipAddress?: string; userAgent?: string },
  db?: DbOrTx,
): Promise<WithdrawResult> {
  // § format ผิด → คำตอบเดียวกับเคสไม่พบ
  const trackingCode = normalizeTrackingCode(rawCode);
  if (!trackingCode) return DENIED;
  const _db = db ?? (await getDb());

  const caseRow = await firstOrUndefined(
    _db
      .select({ id: cases.id, submittedBy: cases.submittedBy })
      .from(cases)
      .where(eq(cases.trackingCode, trackingCode))
      .limit(1),
  );
  if (!caseRow) return DENIED;

  const denial = await ownershipDenial(_db, caseRow.submittedBy, proof);
  if (denial) {
    await logAudit(
      {
        action: AUDIT_ACTIONS.CONSENT_WITHDRAW_DENIED,
        resource: 'consent',
        resourceId: caseRow.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { reason: denial },
      },
      _db,
    );
    return DENIED;
  }

  const via = proof.kind === 'line' ? 'liff' : 'web';
  const withdrawal = {
    userId: caseRow.submittedBy,
    caseId: caseRow.id,
    trackingCode,
    via,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  } as const;
  // § citizen-access เป็นเจ้าของ tx — helper ไม่เปิด tx เอง (กันซ้อนกับ withdrawConsent ของ c6)
  // audit ล้ม = revoke rollback ด้วย
  if (db) {
    await revokeConsentWithAudit(withdrawal, db);
  } else {
    await _db.transaction(async (tx) => {
      await revokeConsentWithAudit(withdrawal, tx);
    });
  }
  return { ok: true };
}

/** คืน null เมื่อพิสูจน์ได้ว่าเป็นเจ้าของ ไม่งั้นคืนเหตุผล (ใช้ใน audit เท่านั้น) */
async function ownershipDenial(
  db: DbOrTx,
  ownerId: string,
  proof: OwnershipProof,
): Promise<DenialReason | null> {
  if (proof.kind === 'line') {
    const owned = await firstOrUndefined(
      db
        .select({ id: lineUsers.id })
        .from(lineUsers)
        .where(and(eq(lineUsers.lineUserId, proof.lineUserId), eq(lineUsers.linkedUserId, ownerId)))
        .limit(1),
    );
    return owned ? null : 'not_case_owner_line';
  }

  // § ตัวตนของผู้แจ้งทางเว็บผูกกับ HMAC ของ CID เสมอ (ดู resolveCitizen) — email ที่กรอกไม่ใช่ identity key
  const owner = await firstOrUndefined(
    db.select({ email: users.email }).from(users).where(eq(users.id, ownerId)).limit(1),
  );
  if (!owner) return 'submitter_missing';
  return owner.email === cidPlaceholderEmail(proof.cid) ? null : 'cid_mismatch';
}
