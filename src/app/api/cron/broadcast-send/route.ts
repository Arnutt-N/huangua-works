import { NextResponse } from 'next/server';
import { getDueScheduled, sendBroadcast } from '@/lib/line/broadcast-service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const due = await getDueScheduled();
  let sent = 0;

  for (const item of due) {
    await sendBroadcast(item.id);
    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
