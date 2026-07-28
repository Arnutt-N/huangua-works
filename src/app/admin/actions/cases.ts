'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/require-staff';
import { applyCaseUpdate, type CaseActor } from '@/lib/cases/operations';
import {
  changeStatusFormSchema,
  assignOfficerFormSchema,
  changeDepartmentFormSchema,
  setPriorityFormSchema,
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
  const auth = await requireStaff(['chief', 'head', 'superadmin']);
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
    isPublic: isPublic !== 'false',
  }, toActor(auth));

  if (!result.ok) return { error: result.error };

  revalidatePath(`/admin/cases/${caseId}`);
  redirect(`/admin/cases/${caseId}?ok=comment`);
}
