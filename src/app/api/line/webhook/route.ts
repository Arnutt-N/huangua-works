import { NextResponse } from 'next/server';
import { verifyLineSignature } from '@/lib/line/signature';
import { handleEvent } from '@/lib/line/bot/engine';
import type { LineWebhookRequestBody } from '@/lib/line/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('x-line-signature');

  if (!verifyLineSignature(body, signature)) {
    return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
  }

  const parsed: LineWebhookRequestBody = JSON.parse(body);

  await Promise.all(parsed.events.map(handleEvent));

  return NextResponse.json({ ok: true });
}
