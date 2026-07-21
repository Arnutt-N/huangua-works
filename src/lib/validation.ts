import { z } from 'zod';

/**
 * Validation schemas — source of truth สำหรับทุก input boundary
 *
 * ใช้ zod 4.x — ทุก API route + server action ต้อง validate ผ่าน schema ที่นี่ก่อน
 * ป้องกัน: malformed input, oversize payload, injection, type confusion
 *
 * PDPA relevance: จำกัดความยาว field ที่เก็บข้อมูลประชาชน → ป้องกัน abuse + จำกัด
 * ขอบเขตข้อมูลที่รั่วไหลได้กรณี DB breach
 */

// ────────────────────────────────────────────────────────────────────────────
// § Primitives
// ────────────────────────────────────────────────────────────────────────────

export const cidSchema = z
  .string()
  .min(13, 'เลขบัตรประชาชนต้องมี 13 หลัก')
  .max(13, 'เลขบัตรประชาชนต้องมี 13 หลัก')
  .regex(/^\d{13}$/, 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก');

export const emailSchema = z
  .string()
  .min(3, 'อีเมลสั้นเกินไป')
  .max(254, 'อีเมลยาวเกินไป')
  .email('รูปแบบอีเมลไม่ถูกต้อง')
  .transform((v) => v.toLowerCase().trim());

export const phoneSchema = z
  .string()
  .max(20, 'เบอร์โทรยาวเกินไป')
  .regex(/^[\d+\-\s()]+$/, 'รูปแบบเบอร์โทรไม่ถูกต้อง')
  .or(z.literal(''))
  .optional();

export const fullNameSchema = z
  .string()
  .min(2, 'ชื่อสั้นเกินไป')
  .max(100, 'ชื่อยาวเกินไป')
  .transform((v) => v.trim());

export const caseTitleSchema = z
  .string()
  .min(5, 'หัวเรื่องสั้นเกินไป (อย่างน้อย 5 ตัวอักษร)')
  .max(200, 'หัวเรื่องยาวเกิน 200 ตัวอักษร')
  .transform((v) => v.trim());

export const caseDescriptionSchema = z
  .string()
  .min(10, 'รายละเอียดสั้นเกินไป (อย่างน้อย 10 ตัวอักษร)')
  .max(5000, 'รายละเอียดยาวเกิน 5,000 ตัวอักษร')
  .transform((v) => v.trim());

export const locationSchema = z
  .string()
  .min(3, 'ที่ตั้งสั้นเกินไป')
  .max(500, 'ที่ตั้งยาวเกิน 500 ตัวอักษร')
  .transform((v) => v.trim());

export const commentSchema = z
  .string()
  .min(1, 'กรุณากรอกข้อความ')
  .max(2000, 'ข้อความยาวเกิน 2,000 ตัวอักษร')
  .transform((v) => v.trim());

export const uuidSchema = z
  .string()
  .min(1, 'ต้องระบุ id')
  .max(64, 'id ยาวเกินไป');

export const trackingCodeSchema = z
  .string()
  .min(1, 'ต้องระบุ tracking code')
  .max(20, 'tracking code ยาวเกินไป')
  .regex(/^[A-Za-z0-9]+$/, 'tracking code มีอักขระไม่ถูกต้อง');

// ────────────────────────────────────────────────────────────────────────────
// § Enums (mirror DB pgEnum)
// ────────────────────────────────────────────────────────────────────────────

export const caseStatusSchema = z.enum([
  'received',
  'reviewing',
  'assigned',
  'in_progress',
  'done',
  'closed',
  'rejected',
]);

export const casePrioritySchema = z.enum(['normal', 'urgent']);

export const userRoleSchema = z.enum([
  'citizen',
  'officer',
  'chief',
  'head',
  'superadmin',
]);

// ────────────────────────────────────────────────────────────────────────────
// § API request schemas
// ────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/cases/submit — citizen intake form
 */
export const submitCaseSchema = z.object({
  cid: cidSchema,
  fullName: fullNameSchema,
  phoneNumber: phoneSchema,
  email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง').optional().or(z.literal('')),
  categoryId: uuidSchema,
  title: caseTitleSchema,
  description: caseDescriptionSchema,
  location: locationSchema,
  consent: z.literal(true, {
    message: 'กรุณายินยอมให้เก็บข้อมูลก่อนส่งเรื่อง',
  }),
  attachments: z
    .array(
      z.object({
        url: z.string().url().max(2048),
        type: z.string().max(100),
        size: z.number().int().min(0).max(10_000_000), // 10MB max
      }),
    )
    .max(5, 'แนบไฟล์ได้สูงสุด 5 ไฟล์')
    .optional(),
});

/**
 * PATCH /api/admin/cases/[id] — admin update case
 */
export const patchCaseSchema = z.object({
  status: caseStatusSchema.optional(),
  assignedTo: uuidSchema.nullable().optional(),
  departmentId: uuidSchema.nullable().optional(),
  priority: casePrioritySchema.optional(),
  comment: commentSchema.optional(),
});

/**
 * POST /api/consent/withdraw — citizen withdraws PDPA consent
 */
export const consentWithdrawSchema = z.object({
  trackingCode: trackingCodeSchema,
  cid: cidSchema,
});

// ────────────────────────────────────────────────────────────────────────────
// § Server action form schemas (FormData-based)
// ────────────────────────────────────────────────────────────────────────────

/**
 * changeStatus action — FormData fields
 */
export const changeStatusFormSchema = z.object({
  caseId: uuidSchema,
  status: caseStatusSchema,
  comment: z.string().max(2000).optional().transform((v) => v?.trim() || null),
  isPublic: z.string().optional(),
});

export const assignOfficerFormSchema = z.object({
  caseId: uuidSchema,
  officerId: z.string().min(1),
});

export const changeDepartmentFormSchema = z.object({
  caseId: uuidSchema,
  departmentId: z.string().min(1),
});

export const setPriorityFormSchema = z.object({
  caseId: uuidSchema,
  priority: casePrioritySchema,
});

export const addUpdateFormSchema = z.object({
  caseId: uuidSchema,
  comment: commentSchema,
  isPublic: z.string().optional(),
});

/**
 * User management actions
 */
export const createUserFormSchema = z.object({
  email: emailSchema,
  fullName: fullNameSchema,
  role: z.enum(['officer', 'chief', 'head', 'superadmin']),
  departmentId: z.string().optional(),
  password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร').max(128),
});

export const updateUserRoleFormSchema = z.object({
  userId: uuidSchema,
  role: z.enum(['officer', 'chief', 'head', 'superadmin']),
  departmentId: z.string().optional(),
});

export const resetPasswordFormSchema = z.object({
  userId: uuidSchema,
  newPassword: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร').max(128),
});

// ────────────────────────────────────────────────────────────────────────────
// § Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * แปลง ZodError เป็น Thai error message สำหรับ user-facing
 * ใช้ first error only (เพราะ user อ่านทีละข้อความ)
 */
export function zodErrorToMessage(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return 'ข้อมูลไม่ถูกต้อง';
  return first.message;
}

/**
 * Validate และคืน { success: true, data } หรือ { success: false, error }
 * สำหรับ API routes
 */
export function validateOrError<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: zodErrorToMessage(result.error) };
}

/**
 * Validate FormData สำหรับ server actions
 * คืน { success: true, data } หรือ { success: false, error }
 */
export function validateFormData<T>(
  schema: z.ZodSchema<T>,
  formData: FormData,
): { success: true; data: T } | { success: false; error: string } {
  const obj: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    if (typeof value === 'string') obj[key] = value;
  });
  return validateOrError(schema, obj);
}
