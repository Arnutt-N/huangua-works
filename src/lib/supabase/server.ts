import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Supabase client สำหรับ Server Component / Route Handler / Server Action
 * Next.js 16: cookies() เป็น async ต้อง await ก่อนใช้
 *
 * setAll อาจถูกเรียกจาก Server Component render (read-only context) ซึ่ง Next.js
 * จะ throw — ครอบ try/catch เพราะ middleware เป็นตัวรับผิดชอบ refresh session cookie จริง
 * (Server Component แค่ต้องอ่าน session ได้ ไม่จำเป็นต้องเขียนคืน)
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              // บังคับ httpOnly เสมอ — ไม่มี code path ไหนในแอปที่ต้องอ่าน session cookie
              // ผ่าน browser JS เลย (login/logout เป็น Server Action, /admin เป็น Server
              // Component ทั้งหมด) ตรงตาม PRD ที่ห้ามเก็บ token ที่ JS อ่านได้
              cookieStore.set(name, value, { ...options, httpOnly: true });
            }
          } catch {
            // เรียกจาก Server Component (read-only) — ปล่อยผ่าน middleware จัดการ refresh แทน
          }
        },
      },
    }
  );
}
