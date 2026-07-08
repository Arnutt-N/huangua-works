/**
 * Budget validation — ตรวจสอบงบประมาณ (ถ้ามี)
 * สำหรับเรื่องที่ต้องใช้งบ เช่น ซ่อมถนน/สะพาน/อาคาร
 * ตรวจสอบว่าอยู่ในวงเงินที่อนุมัติหรือไม่
 */

export interface BudgetItem {
  fiscalYear: number; // ปีงบประมาณ พ.ศ.
  categoryId: string;
  departmentId: string;
  allocated: number; // งบประมาณจัดสรร (บาท)
  spent: number; // ใช้ไปแล้ว (บาท)
  reserved: number; // จองไว้ (บาท)
}

/**
 * ตรวจสอบว่างบประมาณพอหรือไม่
 */
export function checkBudgetAvailable(
  budget: BudgetItem,
  requestedAmount: number
): { available: boolean; remaining: number } {
  const remaining = budget.allocated - budget.spent - budget.reserved;
  return {
    available: remaining >= requestedAmount,
    remaining,
  };
}

/**
 * คำนวณเปอร์เซ็นต์การใช้งบ
 */
export function calculateBudgetUtilization(budget: BudgetItem): number {
  if (budget.allocated === 0) return 0;
  return ((budget.spent + budget.reserved) / budget.allocated) * 100;
}

/**
 * Format จำนวนเงินเป็นภาษาไทย (บาท)
 */
export function formatBaht(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
  }).format(amount);
}
