/** GET /api/cron/case-notifications — ส่ง outbox แจ้งเตือนเรื่องใหม่ที่ commit แล้ว */
import { NextResponse } from 'next/server';
import { dispatchPendingCaseNotifications } from '@/lib/cases/intake';
import { requireCron } from '@/lib/cron-auth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = requireCron(request);
  if (!auth.ok) return auth.response;
  const result = await dispatchPendingCaseNotifications();
  return NextResponse.json({ ok: true, ...result });
}
