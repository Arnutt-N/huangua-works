'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { cases, consentRecords, lineUsers, users } from '@/lib/db/schema';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { requireStaff } from '@/lib/auth/require-staff';
import { SUPERADMIN_ONLY } from '@/lib/auth/roles';
import {
  setCitizenCidFormSchema,
  updateCitizenFormSchema,
  validateFormData,
} from '@/lib/validation';
import { isValidCid } from '@/lib/cid-checksum';
import { cidPlaceholderEmail } from '@/lib/cases/citizen-access/identity';

/**
 * Server actions สำหรับบัญชีประชาชน (/admin/citizens, superadmin เท่านั้น)
 *
 * ขอบเขต: แก้ไขข้อมูลติดต่อ, เปิด/ปิดใช้งาน, ผูกเลขบัตร, ถอดผูก LINE, ลบ
 * ทุก action: requireStaff(SUPERADMIN_ONLY) → validate → tx(DB + audit) → revalidate
 *
 * § ไม่ redirect หลัง mutation (ต่างจาก actions/users.ts) — หน้ามีช่องค้นหา (q)
 * redirect จะล้างคำค้นทุกครั้งที่บันทึก จึงคืน success ให้ dialog ปิดตัวเองแทน
 * (pattern เดียวกับ actions/master-data.ts)
 *
 * § ไม่ log เลขบัตรดิบที่ไหนทั้งสิ้น — audit metadata เก็บได้แค่ placeholder email
 * (มีแค่ hash) ส่วน console.* ห้ามแตะ PII (พิมพ์ได้แค่ id/count)
 */

export interface CitizenActionState {
  error: string | null;
  success?: string;
}

/** อ่าน metadata ที่อาจเป็น object (jsonb) หรือ string — รวม contactEmail ใหม่โดยไม่ทับ key อื่น */
function readMetadata(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

async function getCitizenOrError(
  userId: string,
): Promise<{ target: typeof users.$inferSelect } | { error: string }> {
  const db = await getDb();
  const target = await firstOrUndefined(
    db.select().from(users).where(eq(users.id, userId)).limit(1),
  );
  if (!target) return { error: 'ไม่พบบัญชีนี้' };
  if (target.role !== 'citizen') return { error: 'บัญชีนี้ไม่ใช่บัญชีประชาชน' };
  return { target };
}

// ────────────────────────────────────────────────────────────────────────────
// 1. แก้ไขชื่อ/เบอร์/อีเมลติดต่อ (contactEmail อยู่ใน metadata ไม่ใช่ identity key)
// ────────────────────────────────────────────────────────────────────────────

export async function updateCitizen(
  _prevState: CitizenActionState,
  formData: FormData,
): Promise<CitizenActionState> {
  const { user: actor, ipAddress, userAgent } = await requireStaff(SUPERADMIN_ONLY);

  const v = validateFormData(updateCitizenFormSchema, formData);
  if (!v.success) return { error: v.error };
  const { userId, fullName, phoneNumber, contactEmail } = v.data;

  const found = await getCitizenOrError(userId);
  if ('error' in found) return { error: found.error };

  const metadata = readMetadata(found.target.metadata);
  if (contactEmail) {
    metadata.contactEmail = contactEmail;
  } else {
    delete metadata.contactEmail;
  }

  const db = await getDb();
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          fullName,
          phoneNumber: phoneNumber || null,
          metadata: JSON.stringify(metadata),
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      await logAudit(
        {
          userId: actor.id,
          action: AUDIT_ACTIONS.CITIZEN_UPDATE,
          resource: 'users',
          resourceId: userId,
          ipAddress,
          userAgent,
          metadata: { fullName },
        },
        tx,
      );
    });
  } catch (err) {
    console.error('[updateCitizen] failed', err);
    return { error: 'เกิดข้อผิดพลาดในการบันทึก' };
  }

  revalidatePath('/admin/citizens');
  return { error: null, success: 'บันทึกข้อมูลประชาชนเรียบร้อย' };
}

// ────────────────────────────────────────────────────────────────────────────
// 2. เปิด/ปิดใช้งาน — ปิดแล้วเรื่องของบัญชีนี้หายจาก /track ทุกช่องทางทันที
//    (consentActiveFor เช็ค users.is_active ด้วย) เปิดใหม่กลับมาโดยไม่ต้องยินยอมใหม่
// ────────────────────────────────────────────────────────────────────────────

export async function toggleCitizenActive(
  _prevState: CitizenActionState,
  formData: FormData,
): Promise<CitizenActionState> {
  const { user: actor, ipAddress, userAgent } = await requireStaff(SUPERADMIN_ONLY);

  const userId = formData.get('userId');
  if (typeof userId !== 'string' || !userId) {
    return { error: 'ข้อมูลไม่ครบถ้วน' };
  }

  const found = await getCitizenOrError(userId);
  if ('error' in found) return { error: found.error };
  // § ไม่ต้องกัน self-toggle — actor เป็น superadmin ส่วน target ต้องเป็น citizen เท่านั้น

  const newActive = !found.target.isActive;
  const db = await getDb();
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ isActive: newActive, updatedAt: new Date() })
        .where(eq(users.id, userId));

      await logAudit(
        {
          userId: actor.id,
          action: newActive ? AUDIT_ACTIONS.CITIZEN_ACTIVATE : AUDIT_ACTIONS.CITIZEN_DEACTIVATE,
          resource: 'users',
          resourceId: userId,
          ipAddress,
          userAgent,
          metadata: { fullName: found.target.fullName, previousState: found.target.isActive },
        },
        tx,
      );
    });
  } catch (err) {
    console.error('[toggleCitizenActive] failed', err);
    return { error: 'เกิดข้อผิดพลาดในการอัปเดต' };
  }

  revalidatePath('/admin/citizens');
  return { error: null, success: newActive ? 'เปิดใช้งานบัญชีเรียบร้อย' : 'ระงับบัญชีเรียบร้อย เรื่องของบัญชีนี้ซ่อนจากช่องทางประชาชนแล้ว' };
}

// ────────────────────────────────────────────────────────────────────────────
// 3. ผูกเลขบัตร — ตรวจ checksum แล้ว re-key email เป็น cid- placeholder
//    ชนกับบัญชีอื่น = ปฏิเสธ (ห้ามรวมบัญชีอัตโนมัติ) — users.id ไม่เปลี่ยน
//    เคส/consent เดิมจึงตามมาทั้งหมดโดยไม่ต้องย้าย
// ────────────────────────────────────────────────────────────────────────────

export async function setCitizenCid(
  _prevState: CitizenActionState,
  formData: FormData,
): Promise<CitizenActionState> {
  const { user: actor, ipAddress, userAgent } = await requireStaff(SUPERADMIN_ONLY);

  const v = validateFormData(setCitizenCidFormSchema, formData);
  if (!v.success) return { error: v.error };
  const { userId, cid } = v.data;

  // § zod เช็คแค่รูป 13 หลัก — checksum ตรวจที่นี่ (กันเลขมั่วที่รูปถูกแต่ไม่มีจริง)
  if (!isValidCid(cid)) {
    return { error: 'เลขบัตรประชาชนไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' };
  }

  const found = await getCitizenOrError(userId);
  if ('error' in found) return { error: found.error };

  const placeholder = cidPlaceholderEmail(cid);
  const db = await getDb();
  const owner = await firstOrUndefined(
    db.select({ id: users.id }).from(users).where(eq(users.email, placeholder)).limit(1),
  );
  if (owner && owner.id !== userId) {
    return { error: 'เลขบัตรประชาชนนี้ถูกใช้กับบัญชีอื่นแล้ว ไม่สามารถรวมบัญชีอัตโนมัติได้' };
  }
  if (owner && owner.id === userId) {
    return { error: null, success: 'บัญชีนี้ผูกกับเลขบัตรนี้อยู่แล้ว' };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ email: placeholder, updatedAt: new Date() })
        .where(eq(users.id, userId));

      await logAudit(
        {
          userId: actor.id,
          action: AUDIT_ACTIONS.CITIZEN_SET_CID,
          resource: 'users',
          resourceId: userId,
          ipAddress,
          userAgent,
          // § เก็บได้แค่ placeholder (มีแค่ hash) — ห้ามใส่เลขบัตรดิบใน audit
          metadata: { email: placeholder },
        },
        tx,
      );
    });
  } catch (err) {
    console.error('[setCitizenCid] failed', err);
    return { error: 'เกิดข้อผิดพลาดในการผูกเลขบัตร' };
  }

  revalidatePath('/admin/citizens');
  return { error: null, success: 'ผูกเลขบัตรประชาชนเรียบร้อย' };
}

// ────────────────────────────────────────────────────────────────────────────
// 4. ถอดผูก LINE — null linkedUserId ทุกแถวที่ผูกกับบัญชีนี้
// ────────────────────────────────────────────────────────────────────────────

export async function unlinkCitizenLine(
  _prevState: CitizenActionState,
  formData: FormData,
): Promise<CitizenActionState> {
  const { user: actor, ipAddress, userAgent } = await requireStaff(SUPERADMIN_ONLY);

  const userId = formData.get('userId');
  if (typeof userId !== 'string' || !userId) {
    return { error: 'ข้อมูลไม่ครบถ้วน' };
  }

  const found = await getCitizenOrError(userId);
  if ('error' in found) return { error: found.error };

  const db = await getDb();
  try {
    const unlinked = await db.transaction(async (tx) => {
      const rows = await tx
        .update(lineUsers)
        .set({ linkedUserId: null, updatedAt: new Date() })
        .where(eq(lineUsers.linkedUserId, userId))
        .returning({ id: lineUsers.id });

      await logAudit(
        {
          userId: actor.id,
          action: AUDIT_ACTIONS.CITIZEN_UNLINK_LINE,
          resource: 'users',
          resourceId: userId,
          ipAddress,
          userAgent,
          metadata: { unlinkedCount: rows.length },
        },
        tx,
      );
      return rows.length;
    });
    void unlinked;
  } catch (err) {
    console.error('[unlinkCitizenLine] failed', err);
    return { error: 'เกิดข้อผิดพลาดในการถอดผูก LINE' };
  }

  revalidatePath('/admin/citizens');
  return { error: null, success: 'ถอดการผูก LINE เรียบร้อย' };
}

// ────────────────────────────────────────────────────────────────────────────
// 5. ลบ — ปฏิเสธเมื่อมีเรื่องอ้างถึง (ให้ปิดใช้แทน) นอกนั้นลบ user + consent
// ────────────────────────────────────────────────────────────────────────────

export async function deleteCitizen(
  _prevState: CitizenActionState,
  formData: FormData,
): Promise<CitizenActionState> {
  const { user: actor, ipAddress, userAgent } = await requireStaff(SUPERADMIN_ONLY);

  const userId = formData.get('userId');
  if (typeof userId !== 'string' || !userId) {
    return { error: 'ข้อมูลไม่ครบถ้วน' };
  }

  const found = await getCitizenOrError(userId);
  if ('error' in found) return { error: found.error };

  const db = await getDb();
  const referenced = await firstOrUndefined(
    db.select({ id: cases.id }).from(cases).where(eq(cases.submittedBy, userId)).limit(1),
  );
  if (referenced) {
    return { error: 'ลบบัญชีนี้ไม่ได้ เพราะยังมีเรื่องแจ้งที่อ้างถึงอยู่ (ให้ปิดใช้งานแทน)' };
  }

  try {
    await db.transaction(async (tx) => {
      // § ตัดผูก LINE ก่อนลบ — กัน linkedUserId ลอยชี้ไปหา id ที่ไม่มีแล้ว
      await tx
        .update(lineUsers)
        .set({ linkedUserId: null, updatedAt: new Date() })
        .where(eq(lineUsers.linkedUserId, userId));
      await tx.delete(consentRecords).where(eq(consentRecords.userId, userId));
      await tx.delete(users).where(eq(users.id, userId));

      await logAudit(
        {
          userId: actor.id,
          action: AUDIT_ACTIONS.CITIZEN_DELETE,
          resource: 'users',
          resourceId: userId,
          ipAddress,
          userAgent,
          metadata: { fullName: found.target.fullName },
        },
        tx,
      );
    });
  } catch (err) {
    console.error('[deleteCitizen] failed', err);
    return { error: 'เกิดข้อผิดพลาดในการลบ' };
  }

  revalidatePath('/admin/citizens');
  return { error: null, success: 'ลบบัญชีประชาชนเรียบร้อย' };
}
