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
