import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// LINE URL verification — called when setting up the webhook URL in LINE Developers console
// § endpoint นี้ไม่ verify signature โดยเจตนา (LINE ยิงมาตอนกด "Verify" ก่อนตั้งค่าเสร็จ)
// จึงไม่ทำอะไรนอกจากตอบ 200 — ห้ามเพิ่ม side effect ที่นี่ ให้ไปที่ /api/line/webhook แทน
export async function POST(request: Request) {
  // body ที่ parse ไม่ได้ต้องไม่กลายเป็น 500 — ใครก็ยิง endpoint นี้ได้
  await request.json().catch(() => null);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ status: 'LINE webhook callback endpoint' });
}
