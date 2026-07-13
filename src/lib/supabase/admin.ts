import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client — bypass RLS, ใช้เฉพาะงาน admin ฝั่ง server เท่านั้น
 * (เช่น seed script สร้าง staff account จริง) ห้าม import จากโค้ดที่รันฝั่ง client
 *
 * ไม่ใส่ 'server-only' guard เพราะไฟล์นี้ต้อง import ได้จาก scripts/seed.ts (plain tsx,
 * ไม่ใช่ Next.js bundler context — 'server-only' throw unconditionally นอก context นั้น)
 * ความปลอดภัยจริงมาจาก SUPABASE_SERVICE_ROLE_KEY ไม่มี prefix NEXT_PUBLIC_ อยู่แล้ว
 * Next.js จึงไม่มีทาง bundle ค่านี้เข้า client โดย design ของ framework เอง
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('createAdminClient() ห้ามเรียกจากฝั่ง browser');
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
