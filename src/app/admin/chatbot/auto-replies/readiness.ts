/**
 * ความพร้อมหมวดเจตนา — สำเนาเดียว (เดิม 3 สำเนา: intent-section, intent-detail, dashboard)
 *
 * § dashboard เคยตรวจ isActive นอก readinessOf ส่วน 2 หน้าที่เหลือไม่ตรวจ —
 * รวมเกณฑ์ปิดใช้งานไว้ข้างในที่เดียว ให้ badge 3 ที่พูดตรงกัน
 */
export function readinessOf(item: {
  isActive: boolean;
  keywords: unknown[];
  responses: unknown[];
}): { ready: boolean; reason: string } {
  if (!item.isActive) return { ready: false, reason: 'ปิดใช้งาน' };
  if (item.keywords.length === 0) return { ready: false, reason: 'ยังไม่มี keyword' };
  if (item.responses.length === 0) return { ready: false, reason: 'ยังไม่มีคำตอบ' };
  return { ready: true, reason: 'พร้อม' };
}
