'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { requireStaff } from '@/lib/auth/require-staff';
import { CASE_SUPERVISOR_ROLES } from '@/lib/auth/roles';
import { notifyCitizenStatusChange } from '@/lib/cases/line-notify';
import { applyCaseUpdate, type CaseActor } from '@/lib/cases/operations';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { cases, caseUpdates } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { deleteFile, isStorageConfigured, uploadFile } from '@/lib/storage';
import {
  MEDIA_MAX_SIZE_BYTES,
  MEDIA_SIZE_ERROR,
  MEDIA_TYPE_ERROR,
  sniffImageMime,
} from '@/lib/media-upload-rules';
import {
  appendResolutionPhoto,
  mergeResolutionPhotosIntoMetadata,
  parseResolutionPhotos,
  removeResolutionPhoto,
  type ResolutionPhoto,
  type ResolutionPhotoTag,
} from '@/lib/cases/resolution-photos';
import {
  changeStatusFormSchema,
  assignOfficerFormSchema,
  changeDepartmentFormSchema,
  setPriorityFormSchema,
  changeBudgetFormSchema,
  changeBudgetAmountFormSchema,
  changeActionDetailsFormSchema,
  addUpdateFormSchema,
  validateFormData,
} from '@/lib/validation';

export interface CaseActionState {
  error: string | null;
  success?: string;
}

function toActor(auth: Awaited<ReturnType<typeof requireStaff>>): CaseActor {
  return {
    userId: auth.user.id,
    role: auth.user.role,
    ipAddress: auth.ipAddress,
    userAgent: auth.userAgent,
  };
}

export async function changeStatus(
  _prevState: CaseActionState,
  formData: FormData
): Promise<CaseActionState> {
  const auth = await requireStaff();
  const v = validateFormData(changeStatusFormSchema, formData);
  if (!v.success) return { error: v.error };
  const { caseId, status, comment, isPublic } = v.data;

  const result = await applyCaseUpdate(caseId, {
    kind: 'status',
    newStatus: status,
    comment,
    isPublic: isPublic === 'true',
  }, toActor(auth));

  if (!result.ok) return { error: result.error };

  const publicChange = isPublic === 'true';
  if (publicChange) {
    await notifyCitizenStatusChange(caseId, status);
  }

  revalidatePath(`/admin/cases/${caseId}`);
  revalidatePath('/admin');
  return { error: null, success: 'บันทึกข้อมูลเรียบร้อย' };
}

export async function assignOfficer(
  _prevState: CaseActionState,
  formData: FormData
): Promise<CaseActionState> {
  const auth = await requireStaff();
  const v = validateFormData(assignOfficerFormSchema, formData);
  if (!v.success) return { error: v.error };
  const { caseId, officerId } = v.data;

  const result = await applyCaseUpdate(caseId, {
    kind: 'assignment',
    officerId: officerId === '__unassign__' ? null : officerId,
  }, toActor(auth));

  if (!result.ok) return { error: result.error };

  revalidatePath(`/admin/cases/${caseId}`);
  revalidatePath('/admin');
  return { error: null, success: 'บันทึกข้อมูลเรียบร้อย' };
}

export async function changeDepartment(
  _prevState: CaseActionState,
  formData: FormData
): Promise<CaseActionState> {
  const auth = await requireStaff(CASE_SUPERVISOR_ROLES);
  const v = validateFormData(changeDepartmentFormSchema, formData);
  if (!v.success) return { error: v.error };
  const { caseId, departmentId } = v.data;

  const result = await applyCaseUpdate(caseId, {
    kind: 'department',
    departmentId: departmentId === '__unset__' ? null : departmentId,
  }, toActor(auth));

  if (!result.ok) return { error: result.error };

  revalidatePath(`/admin/cases/${caseId}`);
  return { error: null, success: 'บันทึกข้อมูลเรียบร้อย' };
}

export async function setPriority(
  _prevState: CaseActionState,
  formData: FormData
): Promise<CaseActionState> {
  const auth = await requireStaff();
  const v = validateFormData(setPriorityFormSchema, formData);
  if (!v.success) return { error: v.error };
  const { caseId, priority } = v.data;

  const result = await applyCaseUpdate(caseId, {
    kind: 'priority',
    priority,
  }, toActor(auth));

  if (!result.ok) return { error: result.error };

  revalidatePath(`/admin/cases/${caseId}`);
  revalidatePath('/admin');
  return { error: null, success: 'บันทึกข้อมูลเรียบร้อย' };
}

/**
 * เปลี่ยนสถานะงบประมาณ — เรื่องเงินจึงจำกัด supervisor ขึ้นไป (เหมือนเปลี่ยนหน่วยงาน)
 * timeline เป็น internal (ประชาชนไม่เห็นงบ) บันทึก audit UPDATE_CASE_BUDGET
 */
export async function changeBudget(
  _prevState: CaseActionState,
  formData: FormData
): Promise<CaseActionState> {
  const auth = await requireStaff(CASE_SUPERVISOR_ROLES);
  const v = validateFormData(changeBudgetFormSchema, formData);
  if (!v.success) return { error: v.error };
  const { caseId, budgetStatus } = v.data;

  const result = await applyCaseUpdate(caseId, {
    kind: 'budget',
    budgetStatus,
  }, toActor(auth));

  if (!result.ok) return { error: result.error };

  revalidatePath(`/admin/cases/${caseId}`);
  revalidatePath('/admin');
  return { error: null, success: 'บันทึกข้อมูลเรียบร้อย' };
}

/**
 * บันทึกยอดงบประมาณที่ใช้ (บาท) — ช่องว่างคือล้างยอด supervisor ขึ้นไปเท่านั้น
 */
export async function changeBudgetAmount(
  _prevState: CaseActionState,
  formData: FormData
): Promise<CaseActionState> {
  const auth = await requireStaff(CASE_SUPERVISOR_ROLES);
  const v = validateFormData(changeBudgetAmountFormSchema, formData);
  if (!v.success) return { error: v.error };
  const { caseId, budgetAmount } = v.data;

  let amount: number | null = null;
  if (budgetAmount !== undefined && budgetAmount !== '') {
    if (!/^\d{1,12}$/.test(budgetAmount)) return { error: 'ยอดงบประมาณต้องเป็นตัวเลขบาท ไม่ติดลบ' };
    amount = Number(budgetAmount);
  }

  const result = await applyCaseUpdate(caseId, {
    kind: 'budget_amount',
    budgetAmount: amount,
  }, toActor(auth));

  if (!result.ok) return { error: result.error };

  revalidatePath(`/admin/cases/${caseId}`);
  revalidatePath('/admin');
  return { error: null, success: 'บันทึกข้อมูลเรียบร้อย' };
}

/**
 * แก้ไขรายละเอียดการดำเนินการ — ช่องว่างคือล้าง supervisor ขึ้นไปเท่านั้น
 */
export async function changeActionDetails(
  _prevState: CaseActionState,
  formData: FormData
): Promise<CaseActionState> {
  const auth = await requireStaff(CASE_SUPERVISOR_ROLES);
  const v = validateFormData(changeActionDetailsFormSchema, formData);
  if (!v.success) return { error: v.error };
  const { caseId, actionDetails } = v.data;

  const result = await applyCaseUpdate(caseId, {
    kind: 'action_details',
    actionDetails: actionDetails && actionDetails !== '' ? actionDetails : null,
  }, toActor(auth));

  if (!result.ok) return { error: result.error };

  revalidatePath(`/admin/cases/${caseId}`);
  revalidatePath('/admin');
  return { error: null, success: 'บันทึกข้อมูลเรียบร้อย' };
}

export async function addUpdate(
  _prevState: CaseActionState,
  formData: FormData
): Promise<CaseActionState> {
  const auth = await requireStaff();
  const v = validateFormData(addUpdateFormSchema, formData);
  if (!v.success) return { error: v.error };
  const { caseId, comment, isPublic } = v.data;

  const result = await applyCaseUpdate(caseId, {
    kind: 'comment',
    comment,
    /**
     * § privacy by default — ต้อง opt-in ถึงจะเผยแพร่ ไม่ใช่ opt-out
     *
     * เดิมเขียน `isPublic !== 'false'` ซึ่งแปลว่า "เผยแพร่ไว้ก่อนเสมอ เว้นแต่จะสั่งไม่"
     * โน้ตความคืบหน้าเป็นข้อความอิสระที่เจ้าหน้าที่มักพิมพ์ข้อมูลติดต่อของผู้แจ้งหรือ
     * บุคคลที่สามลงไป (เช่น "โทรแจ้งคุณ... เบอร์ ...") ถ้าลืมติ๊ก "หมายเหตุภายใน"
     * ข้อความนั้นจะไปโผล่บนหน้า /track ที่ใครมีเลขติดตามก็เปิดดูได้ทันที
     *
     * การพลาดในทิศทาง "ไม่เผยแพร่" แก้ได้ด้วยการติ๊กเพิ่ม แต่การพลาดในทิศทาง
     * "เผยแพร่ไปแล้ว" แก้ไม่ได้ — จึงต้องให้ค่าเริ่มต้นอยู่ฝั่งที่ปลอดภัยกว่า
     */
    isPublic: isPublic === 'true',
  }, toActor(auth));

  if (!result.ok) return { error: result.error };

  revalidatePath(`/admin/cases/${caseId}`);
  return { error: null, success: 'บันทึกข้อมูลเรียบร้อย' };
}

/**
 * uploadResolutionPhotoAction — แนบภาพถ่ายผลการดำเนินงานของเจ้าหน้าที่ (ก่อนทำ / หลังทำ)
 *
 * § ความปลอดภัยและการทำงาน:
 * - ตรวจสอบสิทธิ์เจ้าหน้าที่ผ่าน requireStaff()
 * - ตรวจสอบความพร้อมของระบบ S3 Storage
 * - ตรวจสอบขนาดไม่เกิน 10MB และ Magic bytes จริง (JPEG, PNG, WebP)
 * - ดำเนินการผ่าน Database Transaction ร่วมกับ `SELECT ... FOR UPDATE` บนเคส
 *   เพื่อป้องกัน Lost Updates จากการแก้ไข metadata พร้อมกัน
 * - บันทึกประวัติใน caseUpdates (updateType: 'attachment', isPublic: true)
 * - บันทึก audit log (AUDIT_ACTIONS.MEDIA_UPLOAD)
 */
export async function uploadResolutionPhotoAction(
  _prevState: CaseActionState,
  formData: FormData,
): Promise<CaseActionState> {
  const auth = await requireStaff();

  if (!isStorageConfigured()) {
    return { error: 'ระบบจัดเก็บไฟล์ยังไม่เปิดใช้งานในขณะนี้' };
  }

  const caseIdRaw = formData.get('caseId');
  const tagRaw = formData.get('tag');
  const captionRaw = formData.get('caption');
  const file = formData.get('file');

  if (!caseIdRaw || typeof caseIdRaw !== 'string') {
    return { error: 'ไม่พบรหัสเรื่อง' };
  }
  const caseId = caseIdRaw;

  if (tagRaw !== 'before' && tagRaw !== 'after') {
    return { error: 'กรุณาระบุประเภทภาพถ่าย (ก่อนทำ หรือ หลังทำ)' };
  }
  const tag: ResolutionPhotoTag = tagRaw;

  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: 'กรุณาเลือกไฟล์ภาพถ่าย' };
  }

  if (file.size > MEDIA_MAX_SIZE_BYTES) {
    return { error: MEDIA_SIZE_ERROR };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MEDIA_MAX_SIZE_BYTES) {
    return { error: MEDIA_SIZE_ERROR };
  }

  const sniffed = sniffImageMime(buffer);
  if (!sniffed) {
    return { error: MEDIA_TYPE_ERROR };
  }

  const photoId = generateId();
  const key = `cases/resolutions/${caseId}/${photoId}.${sniffed.ext}`;

  try {
    await uploadFile(key, buffer, sniffed.mime);
  } catch (err) {
    console.error('[uploadResolutionPhotoAction] uploadFile failed:', err);
    return { error: 'อัปโหลดไฟล์ไปยังระบบจัดเก็บไม่สำเร็จ กรุณาลองใหม่' };
  }

  const caption = typeof captionRaw === 'string' && captionRaw.trim() ? captionRaw.trim() : undefined;
  const newPhoto: ResolutionPhoto = {
    id: photoId,
    key,
    url: null,
    tag,
    caption,
    size: file.size,
    type: sniffed.mime,
    uploadedAt: new Date().toISOString(),
    uploadedBy: auth.user.id,
  };

  const db = await getDb();
  try {
    await db.transaction(async (tx) => {
      const current = await firstOrUndefined(
        tx
          .select({
            id: cases.id,
            metadata: cases.metadata,
            title: cases.title,
          })
          .from(cases)
          .where(eq(cases.id, caseId))
          .limit(1)
          .for('update'),
      );

      if (!current) {
        throw new Error('ไม่พบเรื่องที่ระบุ');
      }

      const currentPhotos = parseResolutionPhotos(current.metadata);
      const updatedPhotos = appendResolutionPhoto(currentPhotos, newPhoto);
      const newMetadata = mergeResolutionPhotosIntoMetadata(current.metadata, updatedPhotos);

      await tx
        .update(cases)
        .set({
          metadata: newMetadata,
          updatedAt: new Date(),
        })
        .where(eq(cases.id, caseId));

      await tx.insert(caseUpdates).values({
        id: generateId(),
        caseId,
        userId: auth.user.id,
        updateType: 'attachment',
        comment: tag === 'before' ? 'แนบภาพก่อนดำเนินการ' : 'แนบภาพผลการดำเนินงาน (หลังทำ)',
        isPublic: true,
        attachments: [
          {
            id: photoId,
            key,
            tag,
            type: sniffed.mime,
            size: file.size,
            caption,
          },
        ],
      });

      await logAudit(
        {
          userId: auth.user.id,
          action: AUDIT_ACTIONS.MEDIA_UPLOAD,
          resource: 'cases',
          resourceId: caseId,
          ipAddress: auth.ipAddress,
          userAgent: auth.userAgent,
          metadata: {
            title: current.title,
            photoId,
            tag,
            key,
          },
        },
        tx,
      );
    });

    revalidatePath(`/admin/cases/${caseId}`);
    revalidatePath('/track');
    return { error: null, success: 'บันทึกภาพถ่ายผลการดำเนินงานเรียบร้อย' };
  } catch (err) {
    console.error('[uploadResolutionPhotoAction] db transaction failed:', err);
    try {
      await deleteFile(key);
    } catch {
      // ignore rollback cleanup failure
    }
    return {
      error: err instanceof Error ? err.message : 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่',
    };
  }
}

/**
 * deleteResolutionPhotoAction — ลบภาพถ่ายผลการดำเนินงานของเจ้าหน้าที่
 *
 * § ความปลอดภัย:
 * - ตรวจสอบ requireStaff()
 * - ลบข้อมูลในฐานข้อมูลด้วย transaction + FOR UPDATE
 * - ลบไฟล์ใน S3 Object Storage
 * - บันทึก audit log (AUDIT_ACTIONS.MEDIA_DELETE)
 */
export async function deleteResolutionPhotoAction(
  _prevState: CaseActionState,
  formData: FormData,
): Promise<CaseActionState> {
  const auth = await requireStaff();

  const caseIdRaw = formData.get('caseId');
  const photoIdRaw = formData.get('photoId');

  if (!caseIdRaw || typeof caseIdRaw !== 'string') {
    return { error: 'ไม่พบรหัสเรื่อง' };
  }
  const caseId = caseIdRaw;

  if (!photoIdRaw || typeof photoIdRaw !== 'string') {
    return { error: 'ไม่พบรหัสภาพถ่าย' };
  }
  const photoId = photoIdRaw;

  const db = await getDb();
  let keyToDelete: string | null = null;
  let removedTag: ResolutionPhotoTag = 'before';

  try {
    await db.transaction(async (tx) => {
      const current = await firstOrUndefined(
        tx
          .select({
            id: cases.id,
            metadata: cases.metadata,
            title: cases.title,
          })
          .from(cases)
          .where(eq(cases.id, caseId))
          .limit(1)
          .for('update'),
      );

      if (!current) {
        throw new Error('ไม่พบเรื่องที่ระบุ');
      }

      const currentPhotos = parseResolutionPhotos(current.metadata);
      const { updatedPhotos, removedPhoto } = removeResolutionPhoto(currentPhotos, photoId);

      if (!removedPhoto) {
        throw new Error('ไม่พบภาพถ่ายที่ต้องการลบ');
      }

      keyToDelete = removedPhoto.key;
      removedTag = removedPhoto.tag;

      const newMetadata = mergeResolutionPhotosIntoMetadata(current.metadata, updatedPhotos);

      await tx
        .update(cases)
        .set({
          metadata: newMetadata,
          updatedAt: new Date(),
        })
        .where(eq(cases.id, caseId));

      await tx.insert(caseUpdates).values({
        id: generateId(),
        caseId,
        userId: auth.user.id,
        updateType: 'attachment',
        comment: `ลบภาพถ่ายผลการดำเนินงาน (${removedTag === 'before' ? 'ก่อนทำ' : 'หลังทำ'})`,
        isPublic: true,
      });

      await logAudit(
        {
          userId: auth.user.id,
          action: AUDIT_ACTIONS.MEDIA_DELETE,
          resource: 'cases',
          resourceId: caseId,
          ipAddress: auth.ipAddress,
          userAgent: auth.userAgent,
          metadata: {
            title: current.title,
            photoId,
            key: keyToDelete,
          },
        },
        tx,
      );
    });

    if (keyToDelete && isStorageConfigured()) {
      try {
        await deleteFile(keyToDelete);
      } catch (err) {
        console.error('[deleteResolutionPhotoAction] deleteFile error:', err);
      }
    }

    revalidatePath(`/admin/cases/${caseId}`);
    revalidatePath('/track');
    return { error: null, success: 'ลบภาพถ่ายเรียบร้อย' };
  } catch (err) {
    console.error('[deleteResolutionPhotoAction] failed:', err);
    return {
      error: err instanceof Error ? err.message : 'ลบภาพถ่ายไม่สำเร็จ กรุณาลองใหม่',
    };
  }
}
