/**
 * LIFF config — pure helpers อ่านค่าจาก env (ใช้ได้ทั้ง server และ client)
 *
 * NEXT_PUBLIC_* เป็น build-time env — client bundle จะถูก inline ตอน build
 * ระบบนี้ optional: ไม่มี LIFF ID = ทุกหน้าทำงานแบบเว็บธรรมดา (provider คืน status
 * 'disabled' และฟอร์มแสดงช่อง CID ตามเดิม)
 */

const LIFF_URL_PREFIX = 'https://liff.line.me';

export function getLiffId(): string | null {
  const id = process.env.NEXT_PUBLIC_LIFF_ID;
  return id && !id.startsWith('YOUR_') && !id.startsWith('CHANGE_ME') ? id : null;
}

/**
 * URL เปิด LIFF — path segment ที่ต่อท้ายจะถูกนำไป "ต่อท้าย" path ของ Endpoint URL
 * (ไม่ใช่แทนที่) — เช่น liffUrl('/track') → เปิด /track ใน LIFF เดียวกัน ไม่ต้องสร้าง
 * LIFF app แยก
 *
 * § ผลที่ตามมา: Endpoint URL ใน LINE Developers Console ต้องตั้งเป็น root
 * `https://huangua-works.vercel.app` เท่านั้น — ถ้าตั้งเป็น /intake ปุ่ม "ติดตาม"
 * (liff.line.me/<id>/track) จะเปิด /intake/track ซึ่ง 404
 *
 * คืน null เมื่อยังไม่ได้ตั้ง LIFF ID — caller ต้องมี fallback เสมอ
 */
export function liffUrl(path = ''): string | null {
  const id = getLiffId();
  if (!id) return null;
  const normalized = path.startsWith('/') || path === '' ? path : `/${path}`;
  return `${LIFF_URL_PREFIX}/${id}${normalized}`;
}
