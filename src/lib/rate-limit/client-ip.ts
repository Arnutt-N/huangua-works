/**
 * อ่าน IP ของ client จาก request headers — ที่เดียวของระบบ
 * ลำดับ: IP แรกของ X-Forwarded-For → X-Real-IP → 'unknown'
 *
 * § pure (รับ object ที่มี get) — ใช้ได้ทั้ง NextRequest.headers ใน route handler
 * และ headers() ของ next/headers ใน server action (ผ่าน getClientIp ใน require-staff.ts)
 * เดิม 4 route เขียนสูตรนี้ซ้ำเอง
 *
 * หมายเหตุ: X-Forwarded-For ปลอมได้ถ้าไม่มี reverse proxy ที่เชื่อถือได้คั่น — นโยบายที่
 * สำคัญจึงจำกัดด้วย subject อื่นคู่กัน (เช่น admin-login ต่อ email) ดู policies.ts
 */
export interface HeaderReader {
  get(name: string): string | null;
}

export function clientIpFromHeaders(headers: HeaderReader): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown';
}
