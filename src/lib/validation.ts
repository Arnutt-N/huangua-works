import { z } from 'zod';
import { ALL_STATUSES } from './cases/state-machine';
import { STAFF_ROLES } from './auth/roles';
import { CONVERSATION_MODES } from './line/chat-modes';

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

export const villageSchema = z
  .string()
  .max(100, 'หมู่บ้านยาวเกินไป')
  .transform((v) => v.trim())
  .or(z.literal(''))
  .optional();

/** id ของ geography tables (province/district/subdistrict) — integer จาก source dataset */
export const geodataIdSchema = z.number().int().positive();

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

export const caseStatusSchema = z.enum(ALL_STATUSES);

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
  location: locationSchema.optional(),
  // § ที่อยู่เชิงโครงสร้าง (cascading dropdown) — optional ใน schema แต่ UI บังคับเลือก
  provinceId: geodataIdSchema.optional(),
  districtId: geodataIdSchema.optional(),
  subDistrictId: geodataIdSchema.optional(),
  villageId: geodataIdSchema.optional(),
  village: villageSchema,
  consent: z.literal(true, {
    message: 'กรุณายินยอมให้เก็บข้อมูลก่อนส่งเรื่อง',
  }),
  // § สัญญาณกันสแปม (ดู src/lib/anti-spam.ts) — optional เพื่อให้ client เก่าส่งได้
  // ฟิลด์ลวงต้องว่างสนิท ผู้ใช้จริงกรอกไม่ได้เพราะซ่อนจากจอ+AT+tab order
  websiteUrl: z.string().max(200).nullish(),
  // เวลาที่ฟอร์ม mount (epoch ms) — server เทียบกับเวลาปัจจุบันว่าส่งเร็วเกินคนหรือไม่
  formStartedAt: z.number().int().positive().optional(),
  attachments: z
    .array(
      z.object({
        // § ต้องบังคับ protocol เอง — zod 4 ข้ามการตรวจ protocol ถ้าไม่ส่ง option มา
        // (ดู $ZodURL ใน zod/v4/core: `if (def.protocol)` — ไม่ระบุ = ผ่านทุก scheme
        //  ที่ `new URL()` แปลงได้ รวม javascript: / data: / file:)
        // field นี้รับจาก /api/cases/submit ซึ่งไม่ต้อง login — ปล่อยไว้คือฝัง
        // `javascript:...` ลง DB รอวันที่มีหน้า admin เอามา render เป็นลิงก์
        url: z
          .string()
          .url({ protocol: /^https?$/ })
          .max(2048),
        type: z.string().max(100),
        size: z.number().int().min(0).max(10_000_000), // 10MB max
      }),
    )
    .max(5, 'แนบไฟล์ได้สูงสุด 5 ไฟล์')
    .optional(),
});

/**
 * POST /api/cases/submit แบบ LIFF — ใช้เมื่อ request มี liff session cookie
 * (server เป็นคนเลือก schema จาก cookie ไม่ใช่ client)
 *
 * § cid ไม่บังคับ (D1) — ตัวตนผูกกับ LINE ที่ผ่านการ verify ID token แล้ว
 * fullName optional เพราะบางบัญชี LINE ไม่มี displayName
 */
export const submitCaseLineSchema = submitCaseSchema
  .omit({ cid: true })
  .extend({ fullName: fullNameSchema.optional() });

/**
 * POST /api/consent/withdraw — citizen withdraws PDPA consent
 */
export const consentWithdrawSchema = z.object({
  trackingCode: trackingCodeSchema,
  cid: cidSchema,
});

/**
 * POST /api/consent/withdraw แบบ LIFF — ยืนยันตัวด้วย liff session cookie แทน CID
 * (ผู้ใช้ที่แจ้งผ่าน LIFF ไม่มี CID ในระบบ จึงถอนผ่านบัญชี LINE ที่ผูกกับเคส)
 */
export const consentWithdrawLineSchema = z.object({
  trackingCode: trackingCodeSchema,
});

/**
 * POST /api/liff/session — แลก LINE ID token (LIFF) เป็น session cookie
 */
export const liffSessionSchema = z.object({
  idToken: z.string().min(6, 'idToken ไม่ถูกต้อง').max(4096, 'idToken ยาวเกินไป'),
});

/**
 * PATCH /api/line/admin/conversations/[id] — เจ้าหน้าที่เปลี่ยนโหมด/ผูกเรื่องแจ้ง/
 * โอนแชท (assignedAdminId) / บันทึกโน้ตภายใน (adminNote)
 * linkedCaseId = null คือถอดการผูกออก, adminNote = null คือลบโน้ต
 */
export const updateConversationSchema = z
  .object({
    mode: z.enum(CONVERSATION_MODES).optional(),
    linkedCaseId: uuidSchema.nullable().optional(),
    assignedAdminId: uuidSchema.optional(),
    transferReason: z.string().trim().max(500).optional(),
    adminNote: z.string().max(2000, 'โน้ตยาวเกิน 2,000 ตัวอักษร').nullable().optional(),
  })
  .refine(
    (v) =>
      v.mode !== undefined ||
      v.linkedCaseId !== undefined ||
      v.assignedAdminId !== undefined ||
      v.adminNote !== undefined,
    { message: 'ต้องระบุ mode, linkedCaseId, assignedAdminId หรือ adminNote' },
  );

/**
 * POST /api/line/admin/conversations/[id]/messages — ข้อความที่เจ้าหน้าที่ส่งออก LINE
 * 5,000 = เพดานของ LINE text message
 */
export const chatReplySchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'กรุณากรอกข้อความ')
    .max(5000, 'ข้อความยาวเกิน 5,000 ตัวอักษร'),
  // idempotency key จาก client — retry ด้วยค่าเดิมจะไม่สร้างข้อความ/push ซ้ำ
  clientTempId: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .optional(),
});

// ────────────────────────────────────────────────────────────────────────────
// § Live chat — canned responses / prefs / tags / search / paging
// ────────────────────────────────────────────────────────────────────────────

/**
 * POST/PATCH /api/line/admin/canned-responses — ข้อความสำเร็จรูป
 * shortcut เป็น natural key สำหรับพิมพ์ "/xxx" ใน composer
 */
export const cannedResponseSchema = z.object({
  title: z.string().trim().min(1, 'กรุณากรอกชื่อ').max(100, 'ชื่อยาวเกิน 100 ตัวอักษร'),
  shortcut: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,30}$/, 'shortcut ใช้ได้เฉพาะ a-z, 0-9 และ - (ยาวไม่เกิน 30)')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  content: z
    .string()
    .trim()
    .min(1, 'กรุณากรอกข้อความ')
    .max(5000, 'ข้อความยาวเกิน 5,000 ตัวอักษร'),
});

export const cannedResponseUpdateSchema = cannedResponseSchema.partial().refine(
  (v) => Object.values(v).some((x) => x !== undefined),
  { message: 'ต้องระบุอย่างน้อย 1 ฟิลด์' },
);

/** PUT /api/line/admin/conversations/[id]/prefs — pin/mute ต่อแอดมิน */
export const chatPrefsSchema = z
  .object({
    pinned: z.boolean().optional(),
    muted: z.boolean().optional(),
  })
  .refine((v) => v.pinned !== undefined || v.muted !== undefined, {
    message: 'ต้องระบุ pinned หรือ muted',
  });

/** สีของ tag = design token variant เท่านั้น — ไม่รับ hex เพื่อคงพาเลตระบบ */
export const TAG_COLORS = ['accent', 'gold', 'success', 'warning', 'danger', 'muted'] as const;

/** POST /api/line/admin/tags */
export const chatTagSchema = z.object({
  name: z.string().trim().min(1, 'กรุณากรอกชื่อป้าย').max(30, 'ชื่อป้ายยาวเกิน 30 ตัวอักษร'),
  color: z.enum(TAG_COLORS).default('accent'),
});

/** PUT /api/line/admin/conversations/[id]/tags — replace-set */
export const conversationTagsSchema = z.object({
  tagIds: z.array(uuidSchema).max(10, 'ติดป้ายได้สูงสุด 10 ป้าย'),
});

/** GET /api/line/admin/search?q= — ค้นหาข้อความในแชท */
export const chatSearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'กรุณากรอกคำค้นหา').max(100, 'คำค้นหายาวเกินไป'),
});

/** GET /api/line/admin/conversations/[id]?before=&limit= — cursor paging */
export const chatPagingQuerySchema = z.object({
  before: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
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
  role: z.enum(STAFF_ROLES),
  departmentId: z.string().optional(),
  password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร').max(128),
});

export const updateUserRoleFormSchema = z.object({
  userId: uuidSchema,
  role: z.enum(STAFF_ROLES),
  departmentId: z.string().optional(),
});

export const resetPasswordFormSchema = z.object({
  userId: uuidSchema,
  newPassword: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร').max(128),
});

// ────────────────────────────────────────────────────────────────────────────
// § Profile — บัญชีของตัวเอง (/admin/profile)
// ────────────────────────────────────────────────────────────────────────────

export const updateProfileFormSchema = z.object({
  fullName: fullNameSchema,
  // เว้นว่างได้ (คอลัมน์ phone_number เป็น nullable) แต่ถ้ากรอกต้องเป็นเบอร์ไทยที่ถูกต้อง
  phoneNumber: z
    .string()
    .trim()
    .max(20)
    .regex(/^0[0-9]{8,9}$/, 'เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0')
    .optional()
    .or(z.literal('')),
});

export const changeOwnPasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'กรุณากรอกรหัสผ่านปัจจุบัน').max(128),
    newPassword: z.string().min(8, 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร').max(128),
    confirmPassword: z.string().max(128),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน',
    path: ['confirmPassword'],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม',
    path: ['newPassword'],
  });

// ────────────────────────────────────────────────────────────────────────────
// § Password reset — รีเซ็ตรหัสผ่านด้วยตนเอง (/admin/forgot-password)
// ตั้งชื่อแยกจาก resetPasswordFormSchema (admin ตั้งตรง) เพื่อไม่ให้ชนกัน
// ────────────────────────────────────────────────────────────────────────────

/** รหัสผ่านใหม่ — ใช้กับ forgot-password reset */
const newPasswordSchema = z
  .string()
  .min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
  .max(128, 'รหัสผ่านยาวเกินไป');

/** plaintext reset token — 64 hex chars จาก crypto.randomBytes(32) */
const resetTokenSchema = z
  .string()
  .min(64, 'ลิงก์รีเซ็ตไม่ถูกต้อง')
  .max(64, 'ลิงก์รีเซ็ตไม่ถูกต้อง')
  .regex(/^[a-f0-9]{64}$/, 'ลิงก์รีเซ็ตไม่ถูกต้อง');

/** ขอรีเซ็ตรหัสผ่าน — กรอกแค่อีเมล (anti-enumeration: คืนผลเหมือนกันเสมอ) */
export const forgotPasswordRequestSchema = z.object({
  email: emailSchema,
});

/** ยืนยันรีเซ็ตรหัสผ่าน — token จากลิงก์ + รหัสผ่านใหม่ + ยืนยัน */
export const forgotPasswordResetSchema = z
  .object({
    token: resetTokenSchema,
    newPassword: newPasswordSchema,
    confirmPassword: z.string().max(128),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน',
    path: ['confirmPassword'],
  });

// ────────────────────────────────────────────────────────────────────────────
// § Master data — หน่วยงาน / หมวดหมู่ (/admin/master-data)
// ────────────────────────────────────────────────────────────────────────────

/**
 * slug ใช้เป็น natural key ที่ปรากฏใน URL/ข้อมูล export จึงจำกัดเป็น
 * a-z 0-9 และขีดกลาง — ไม่รับตัวพิมพ์ใหญ่/ภาษาไทย/ช่องว่าง เพื่อไม่ให้เกิด
 * สองสลักที่ต่างกันแค่ตัวพิมพ์ (departments.slug/categories.slug เป็น unique)
 */
const slugSchema = z
  .string()
  .trim()
  .min(2, 'slug ต้องมีอย่างน้อย 2 ตัวอักษร')
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug ใช้ได้เฉพาะ a-z, 0-9 และ - (เช่น public-works)');

const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร')
  .max(120);

const descriptionSchema = z.string().trim().max(500).optional().or(z.literal(''));

export const departmentFormSchema = z.object({
  id: z.string().optional(),
  name: displayNameSchema,
  slug: slugSchema,
  description: descriptionSchema,
});

export const categoryFormSchema = z.object({
  id: z.string().optional(),
  name: displayNameSchema,
  slug: slugSchema,
  description: descriptionSchema,
  defaultDepartmentId: z.string().optional(),
  // SLA เริ่มต้นของหมวด — 0 วันไม่มีความหมาย และเกิน 365 แปลว่ากรอกผิด
  estimatedDays: z.coerce
    .number()
    .int('จำนวนวันต้องเป็นจำนวนเต็ม')
    .min(1, 'จำนวนวันต้องอย่างน้อย 1')
    .max(365, 'จำนวนวันต้องไม่เกิน 365'),
});

export const toggleActiveFormSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['department', 'category']),
});

// ────────────────────────────────────────────────────────────────────────────
// § จองคิวนัดช่าง (P2-03) — POST/GET /api/queue + server action ฝั่งเจ้าหน้าที่
// ────────────────────────────────────────────────────────────────────────────

/** ช่วงเวลานัดช่าง — วันละ 4 ช่วง, id เสถียรเก็บลงคอลัมน์ slot ตรง ๆ */
export const QUEUE_SLOT_IDS = ['slot_1', 'slot_2', 'slot_3', 'slot_4'] as const;
export type QueueSlotId = (typeof QUEUE_SLOT_IDS)[number];

/** ป้ายช่วงเวลาไทย — ใช้ร่วมกันทั้งหน้า public, API response และหน้าแอดมิน */
export const QUEUE_SLOT_LABELS: Record<QueueSlotId, string> = {
  slot_1: 'เช้า 09:00–10:30',
  slot_2: 'เช้า 10:30–12:00',
  slot_3: 'บ่าย 13:00–14:30',
  slot_4: 'บ่าย 14:30–16:00',
};

export const queueSlotSchema = z.enum(QUEUE_SLOT_IDS);

/** mirror pgEnum queue_booking_status (ดู schema.ts — ค่าเพิ่ม/ลดต้องแก้ทั้งคู่) */
export const queueBookingStatusSchema = z.enum(['booked', 'confirmed', 'done', 'cancelled']);
export type QueueBookingStatus = z.infer<typeof queueBookingStatusSchema>;

export const QUEUE_BOOKING_STATUS_LABELS: Record<QueueBookingStatus, string> = {
  booked: 'จองแล้ว',
  confirmed: 'ยืนยันแล้ว',
  done: 'เสร็จแล้ว',
  cancelled: 'ยกเลิกแล้ว',
};

/** จองล่วงหน้าได้ไม่เกิน 30 วัน — UI (min/max ของ date input) อ่านค่านี้ด้วย */
export const QUEUE_BOOKING_WINDOW_DAYS = 30;

/** แปลง Date → YYYY-MM-DD ตามเวลาท้องถิ่น (ห้ามใช้ toISOString — ได้วัน UTC ผิดวัน) */
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * วันที่นัด — YYYY-MM-DD, ตั้งแต่วันนี้ถึง +30 วัน, เฉพาะวันจันทร์–ศุกร์ (วันราชการ)
 *
 * § ตรวจ "วันที่มีอยู่จริง" ด้วยการประกอบ Date กลับแล้วเทียบ — new Date('2026-02-30')
 * ไม่ throw แต่เลื่อนเป็น 2 มี.ค. ถ้าไม่เทียบจะหลุดเข้าไปจองวันที่ไม่มีอยู่จริง
 */
export const queueBookingDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)')
  .refine(
    (v) => {
      const d = new Date(`${v}T00:00:00`);
      return !Number.isNaN(d.getTime()) && toLocalISODate(d) === v;
    },
    { message: 'วันที่ไม่ถูกต้อง' },
  )
  .refine(
    (v) => {
      const today = toLocalISODate(new Date());
      // § เทียบสตริง YYYY-MM-DD ตรง ๆ ได้เพราะ zero-padded — ลำดับตัวอักษร = ลำดับวัน
      const max = new Date();
      max.setDate(max.getDate() + QUEUE_BOOKING_WINDOW_DAYS);
      return v >= today && v <= toLocalISODate(max);
    },
    { message: `จองได้ตั้งแต่วันนี้ถึงล่วงหน้า ${QUEUE_BOOKING_WINDOW_DAYS} วัน` },
  )
  .refine((v) => new Date(`${v}T00:00:00`).getDay() >= 1 && new Date(`${v}T00:00:00`).getDay() <= 5, {
    message: 'รับนัดเฉพาะวันจันทร์–ศุกร์ (วันราชการ)',
  });

/** เบอร์ติดต่อกลับ — บังคับ (ต่างจาก phoneSchema ของ intake ที่ optional) */
export const queuePhoneSchema = z
  .string()
  .trim()
  .regex(/^0[0-9]{8,9}$/, 'เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0');

export const queueServiceTypeSchema = z
  .string()
  .trim()
  .min(2, 'กรุณาระบุประเภทงานช่าง (เช่น ไฟฟ้าดับ ท่อประปาแตก)')
  .max(100, 'ประเภทงานช่างยาวเกิน 100 ตัวอักษร');

export const queueNoteSchema = z
  .string()
  .trim()
  .max(500, 'รายละเอียดยาวเกิน 500 ตัวอักษร')
  .optional()
  .or(z.literal(''));

/**
 * POST /api/queue — ประชาชนจองคิวนัดช่าง
 *
 * § consent เป็นหลักฐาน PDPA ว่าผู้จองยินยอมให้เก็บชื่อ–เบอร์เพื่อติดต่อเรื่องนัดช่าง
 * ช่องทางนี้ไม่มี user row (ไม่ต้อง login) จึงไม่มีแถวใน consent_records —
 * หลักฐานการยินยอมคือตัวแถวการจองเอง (created_at = เวลากดยินยอม)
 */
export const createQueueBookingSchema = z.object({
  fullName: fullNameSchema,
  phoneNumber: queuePhoneSchema,
  serviceType: queueServiceTypeSchema,
  note: queueNoteSchema,
  bookingDate: queueBookingDateSchema,
  slot: queueSlotSchema,
  consent: z.literal(true, {
    message: 'กรุณายินยอมให้เก็บชื่อ–เบอร์โทรเพื่อติดต่อเรื่องนัดช่าง',
  }),
});

/** GET /api/queue?date= — ดูช่วงที่ว่างของวัน (คืนเฉพาะสถานะว่าง/ไม่ว่าง ไม่มี PII) */
export const queueAvailabilityQuerySchema = z.object({
  date: queueBookingDateSchema,
});

/** server action ฝั่งเจ้าหน้าที่ — เปลี่ยนสถานะคิว + โน้ตภายใน */
export const updateQueueBookingFormSchema = z.object({
  id: uuidSchema,
  status: queueBookingStatusSchema,
  adminNote: z.string().trim().max(500, 'โน้ตยาวเกิน 500 ตัวอักษร').optional().or(z.literal('')),
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
