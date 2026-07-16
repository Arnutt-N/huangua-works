import { handlers } from '@/auth';

/**
 * Next.js catch-all route สำหรับ Auth.js v5
 *
 * รับ request ทั้งหมดภายใต้ /api/auth/* (signin, signout, callback, session, csrf, etc.)
 * Auth.js จัดการ routing/logic เองทั้งหมด — export handlers { GET, POST } พอ.
 */
export const { GET, POST } = handlers;
