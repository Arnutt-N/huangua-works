import { NextResponse } from 'next/server';
import { count } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { cases, users } from '@/lib/db/schema';

export const runtime = 'nodejs';

/**
 * GET /api/health/db — probe ฐานข้อมูลแบบ public ไม่ต้อง login
 * ตอบแค่นับแถว ไม่เคยตอบแถวข้อมูล PII จึงปลอดภัย
 * DB ล่มตอบ 503 รูปเดิมเพื่อให้ monitor แยกได้
 */
export async function GET() {
  const started = Date.now();
  try {
    const db = await getDb();
    const [caseCount, userCount] = await Promise.all([
      db.select({ n: count() }).from(cases),
      db.select({ n: count() }).from(users),
    ]);
    return NextResponse.json({
      ok: true,
      latencyMs: Date.now() - started,
      tables: { cases: caseCount[0]?.n ?? 0, users: userCount[0]?.n ?? 0 },
    });
  } catch {
    return NextResponse.json(
      { ok: false, latencyMs: Date.now() - started, tables: null },
      { status: 503 },
    );
  }
}
