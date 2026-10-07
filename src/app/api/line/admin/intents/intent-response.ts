import { NextResponse } from 'next/server';
import type { IntentWriteResult } from '@/lib/line/bot/intent-store';

// แยกไฟล์เพราะ route.ts ของ Next.js export ได้เฉพาะ handler/config — export อื่นทำให้ build พัง
export function intentWriteErrorResponse(
  result: Exclude<IntentWriteResult, { ok: true }>,
): NextResponse {
  if (result.reason === 'invalid_regex') {
    return NextResponse.json({ error: `regex ไม่ถูกต้อง: ${result.message}` }, { status: 400 });
  }
  return NextResponse.json({ error: 'ไม่พบ intent' }, { status: 404 });
}
