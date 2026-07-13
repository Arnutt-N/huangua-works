import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * เรียกจาก middleware.ts เท่านั้น — refresh session cookie ทุก request ที่เข้า matcher
 * ต้องเรียก supabase.auth.getUser() ทันทีหลังสร้าง client (ไม่มี logic คั่นกลาง)
 * เพราะเป็นตัว trigger token refresh จริง — ข้ามขั้นตอนนี้ = session หมดอายุแล้วไม่ refresh
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            // บังคับ httpOnly เสมอ — ดู src/lib/supabase/server.ts สำหรับเหตุผลเต็ม
            response.cookies.set(name, value, { ...options, httpOnly: true });
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
