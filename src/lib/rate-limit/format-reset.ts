/**
 * แปลงวินาทีรอ rate limit เป็นข้อความไทย — ที่เดียวของระบบ
 * ต่ำกว่า 60 แสดงวินาที · ตั้งแต่ 60 ปัดขึ้นเป็นนาที (ไม่บอกน้อยกว่าเวลารอจริง)
 *
 * § pure ไม่ import อะไร — ใช้ได้ทั้ง server action และ route handler
 */
export function formatReset(resetSeconds: number): string {
  const s = Number.isFinite(resetSeconds) ? Math.max(0, Math.floor(resetSeconds)) : 0;
  if (s < 60) return `${s} วินาที`;
  return `${Math.ceil(s / 60)} นาที`;
}
