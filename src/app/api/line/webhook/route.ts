import { NextResponse } from 'next/server';
import { verifyLineSignature } from '@/lib/line/signature';
import { handleEvent } from '@/lib/line/bot/engine';
import { redis } from '@/lib/upstash';
import { enforceRateLimit } from '@/lib/rate-limit/enforce';
import { clientIpFromHeaders } from '@/lib/rate-limit/client-ip';
import type { LineWebhookEvent, LineWebhookRequestBody } from '@/lib/line/types';

export const runtime = 'nodejs';

const DEDUP_TTL_SECONDS = 300;

// at-most-once: mark ก่อนประมวลผล — LINE redelivery จะไม่ทำข้อความ/เคสซ้ำ
// Redis ล่ม ⇒ fail-open (ยอมเสี่ยง duplicate ดีกว่า drop ข้อความทั้งหมด)
async function isDuplicateEvent(event: LineWebhookEvent): Promise<boolean> {
  if (!event.webhookEventId) return false;
  try {
    const acquired = await redis.set(`webhook:event:${event.webhookEventId}`, '1', {
      nx: true,
      ex: DEDUP_TTL_SECONDS,
    });
    return acquired === null;
  } catch {
    console.warn('[line-webhook] dedup unavailable — processing event (fail-open)');
    return false;
  }
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('x-line-signature');

  if (!verifyLineSignature(body, signature)) {
    return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
  }

  // § rate limit ต่อ IP หลัง verify — request ปลอมไม่เปลือง quota, flood จริงโดน 429
  // policy lineWebhookIp เป็น kind public (fail-open: Redis ล่มยังรับ webhook ได้)
  const rateLimit = await enforceRateLimit('lineWebhookIp', clientIpFromHeaders(request.headers));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: `ส่งคำขอถี่เกินไป กรุณารอ ${rateLimit.reset} วินาที` },
      { status: 429, headers: { 'Retry-After': String(rateLimit.reset) } },
    );
  }

  const parsed: LineWebhookRequestBody = JSON.parse(body);

  await Promise.all(
    parsed.events.map(async (event) => {
      if (await isDuplicateEvent(event)) return;
      try {
        await handleEvent(event);
      } catch (error) {
        // event เดียวพังไม่ควรทำให้ทั้ง batch เป็น 500 (LINE จะ redeliver ทั้งชุด)
        console.error('[line-webhook] event failed', {
          webhookEventId: event.webhookEventId,
          type: event.type,
          error,
        });
      }
    })
  );

  return NextResponse.json({ ok: true });
}
