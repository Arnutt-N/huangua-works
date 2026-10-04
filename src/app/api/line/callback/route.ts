import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// LINE URL verification — called when setting up the webhook URL in LINE Developers console
// § endpoint นี้ไม่ verify signature โดยเจตนา (LINE ยิงมาตอนกด "Verify" ก่อนตั้งค่าเสร็จ)
// จึงไม่ทำอะไรนอกจากตอบ 200 — ห้ามเพิ่ม side effect ที่นี่ ให้ไปที่ /api/line/webhook แทน
export async function POST(request: Request) {
  // § ตั้งใจไม่ใช้ parseBody — handler นี้ทิ้ง body แล้วคืน { ok: true } เสมอ (ACK)
  // parseBody ตอบ 400 เมื่อ JSON พัง = เปลี่ยนพฤติกรรม ห้ามทำโดยไม่ทบทวน (ดูการ์ด c8)
  // ไม่มีการตัดสิน signature ใน handler นี้ — อย่าปะปนกับ /api/line/webhook
  await request.json().catch(() => null);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ status: 'LINE webhook callback endpoint' });
}
