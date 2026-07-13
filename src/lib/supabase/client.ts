import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client สำหรับ Client Component (browser)
 * ใช้ NEXT_PUBLIC_* เท่านั้น — ห้ามใส่ service role key ในไฟล์นี้
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
