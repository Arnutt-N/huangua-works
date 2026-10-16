import { NextResponse, type NextRequest } from 'next/server';
import { handlers } from '@/auth';

/**
 * Next.js catch-all route สำหรับ Auth.js v5
 *
 * รับ request ทั้งหมดภายใต้ /api/auth/* (signin, signout, callback, session, csrf, etc.)
 * Auth.js จัดการ routing/logic เอง — ยกเว้น POST credentials callback ที่บล็อกไว้ (ดูด้านล่าง)
 */
export const { GET } = handlers;

/**
 * § mirror parseActionAndProviderId ของ @auth/core — ตัด basePath แล้ว split('/') ทิ้งช่องว่าง
 * ('/api/auth//callback/credentials/' ก็นับ) ต้องตรงกฎเดียวกันไม่งั้นเลี่ยงด้วย slash ได้
 * (Next ส่งเฉพาะ /api/auth/* มาที่ route นี้ basePath จึงตัดด้วย regex นี้ได้เสมอ)
 */
function isCredentialsCallback(pathname: string): boolean {
  const segments = pathname.replace(/^\/api\/auth/, '').split('/').filter(Boolean);
  return segments.length === 2 && segments[0] === 'callback' && segments[1] === 'credentials';
}

/**
 * § login staff เข้าได้ทางเดียวคือ server action (src/app/admin/actions.ts) ซึ่งมี rate limit
 * ต่อ IP+email และ audit — signIn() ใน action เรียก Auth.js ใน process ไม่ผ่าน HTTP นี้
 * ปล่อย HTTP callback ไว้ = brute-force รหัสผ่านไม่จำกัด (ขอ CSRF จาก /api/auth/csrf ก็ยิงได้)
 */
export async function POST(req: NextRequest): Promise<Response> {
  if (isCredentialsCallback(new URL(req.url).pathname)) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
  return handlers.POST(req);
}
