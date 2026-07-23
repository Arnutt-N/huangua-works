import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// LINE URL verification — called when setting up the webhook URL in LINE Developers console
export async function POST(request: Request) {
  const body = await request.json();

  if (body.type === 'webhook' && body.destination) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ status: 'LINE webhook callback endpoint' });
}
