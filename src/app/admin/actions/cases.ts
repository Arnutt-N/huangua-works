'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/require-staff';
import { CASE_SUPERVISOR_ROLES } from '@/lib/auth/roles';
import { notifyCitizenStatusChange } from '@/lib/cases/line-notify';
import { applyCaseUpdate, type CaseActor } from '@/lib/cases/operations';
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
  redirect(`/admin/cases/${caseId}?ok=status`);
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
  redirect(`/admin/cases/${caseId}?ok=assign`);
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
  redirect(`/admin/cases/${caseId}?ok=department`);
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
  redirect(`/admin/cases/${caseId}?ok=priority`);
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
  redirect(`/admin/cases/${caseId}?ok=budget`);
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
  redirect(`/admin/cases/${caseId}?ok=budget_amount`);
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
  redirect(`/admin/cases/${caseId}?ok=action_details`);
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
  redirect(`/admin/cases/${caseId}?ok=comment`);
}
