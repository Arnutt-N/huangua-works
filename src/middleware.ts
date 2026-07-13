import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * คุมเฉพาะ /admin/* — หน้าอื่น (/, /intake, /track) ไม่แตะ Supabase session เลย
 * ไม่ทำ role/isActive check ที่นี่ (ต้องคิว DB, middleware ควรเร็ว/ไม่แตะ DB)
 * role check จริงอยู่ที่ admin/actions.ts (login) + admin/page.tsx (defensive re-check)
 */
export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);

  const isLoginPage = request.nextUrl.pathname === '/admin/login';

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
