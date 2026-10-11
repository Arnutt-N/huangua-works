/**
 * สถานะงบประมาณของเรื่องแจ้ง — single source of truth
 *
 * Pure module (ห้าม import อะไร): ปลอดภัยใน client bundle และ schema.ts
 * derive pg enum จาก ALL_BUDGET_STATUSES (pattern เดียวกับ caseStatusEnum ← ALL_STATUSES)
 *
 * § แยกจาก CaseStatus.awaiting_budget โดยตั้งใจ — status คือ "ขั้นตอนงาน"
 * (เรื่องเดินถึงขั้นรออนุมัติงบ) ส่วน budgetStatus คือ "สถานะเงิน"
 * (มีงบแล้วหรือยัง) เคสที่ status = done อาจมี budgetStatus = awaiting_budget ได้
 * (งานเสร็จแต่เบิกงบไม่จบ) จึงต้องเป็นคนละ field กัน
 */

export const ALL_BUDGET_STATUSES = ['unspecified', 'has_budget', 'awaiting_budget'] as const;

export type BudgetStatus = (typeof ALL_BUDGET_STATUSES)[number];

export const BUDGET_LABELS_TH: Record<BudgetStatus, string> = {
  unspecified: 'ไม่ระบุ',
  has_budget: 'มีงบประมาณ',
  awaiting_budget: 'รองบประมาณ',
};

/** type guard สำหรับ string ที่ไม่ trust (form input, staging) */
export function isBudgetStatus(value: string): value is BudgetStatus {
  return (ALL_BUDGET_STATUSES as readonly string[]).includes(value);
}
