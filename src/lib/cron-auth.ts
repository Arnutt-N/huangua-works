import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

/**
 * Cron authorization — ด่านเดียวที่ /api/cron/* ทุกตัวใช้ร่วมกัน
 *
 * ไม่ใช่ Vercel Cron (Hobby tier รันได้วันละครั้ง) — scheduler ภายนอก (cron-job.org)
 * ยิงเข้ามาพร้อม `Authorization: Bearer $CRON_SECRET` ดังนั้น endpoint เหล่านี้
 * เปิดรับ caller จากอินเทอร์เน็ตจริง secret คือสิ่งเดียวที่กั้นอยู่
 *
 * เดิม 5 route ก๊อปบล็อกนี้ไปคนละชุดและเทียบด้วย `!==` ธรรมดา ซึ่งหยุดทันทีที่ไบต์แรก
 * ที่ต่างกัน — เทียบแบบ constant-time แทน กัน timing oracle ที่ค่อยๆ กู้ secret ทีละไบต์
 * (ยิงยากผ่าน network แต่ต้นทุนการแก้เท่ากับศูนย์) และรวมไว้ที่เดียวเพื่อไม่ให้
 * route ใหม่ลืมด่านใดด่านหนึ่งไป
 */

const MIN_SECRET_LENGTH = 16;

export type CronAuthResult = { ok: true } | { ok: false; response: NextResponse };

function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  // § ความยาวต่างกัน = ไม่ตรงแน่นอน และ timingSafeEqual จะ throw ถ้าความยาวไม่เท่ากัน
  // ความยาวรั่วอยู่แล้วจาก Content-Length ของ request จึงไม่ใช่ข้อมูลใหม่
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * ใช้คู่กับ early return:
 * ```ts
 * const auth = requireCron(request);
 * if (!auth.ok) return auth.response;
 * ```
 */
export function requireCron(request: Request): CronAuthResult {
  const cronSecret = process.env.CRON_SECRET;

  // กัน `Bearer undefined` ผ่านตอน env หาย
  if (!cronSecret || cronSecret.length < MIN_SECRET_LENGTH) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 }),
    };
  }

  const authHeader = request.headers.get('authorization') ?? '';
  if (!safeEquals(authHeader, `Bearer ${cronSecret}`)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { ok: true };
}
