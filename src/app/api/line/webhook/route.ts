import { NextResponse } from 'next/server';
import { verifyLineSignature } from '@/lib/line/signature';
import { handleEvent } from '@/lib/line/bot/engine';
import { redis } from '@/lib/upstash';
import { enforceRateLimit } from '@/lib/rate-limit/enforce';
import { formatReset } from '@/lib/rate-limit/format-reset';
import { clientIpFromHeaders } from '@/lib/rate-limit/client-ip';
import type { LineWebhookEvent, LineWebhookRequestBody } from '@/lib/line/types';

export const runtime = 'nodejs';

const DEDUP_TTL_SECONDS = 300;

// at-most-once 2 ชั้น — LINE redelivery จะไม่ทำข้อความ/เคสซ้ำ
// ชั้น 1: webhookEventId (ต่อ delivery) · ชั้น 2: line message id (ต่อข้อความ, กัน redelivery ต่าง event id)
// Redis ล่ม ⇒ fail-open (ยอมเสี่ยง duplicate ดีกว่า drop ข้อความทั้งหมด)
function lineMessageIdOf(event: LineWebhookEvent): string | null {
  return event.type === 'message' ? (event.message.id ?? null) : null;
}

async function isDuplicateEvent(event: LineWebhookEvent): Promise<boolean> {
  const keys = [
    ...(event.webhookEventId ? [`webhook:event:${event.webhookEventId}`] : []),
    ...(lineMessageIdOf(event) ? [`webhook:msg:${lineMessageIdOf(event)}`] : []),
  ];
  if (keys.length === 0) return false;
  try {
    const results = await Promise.all(
      keys.map((key) => redis.set(key, '1', { nx: true, ex: DEDUP_TTL_SECONDS })),
    );
    return results.some((acquired) => acquired === null);
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
      { message: `ส่งคำขอถี่เกินไป กรุณารอ ${formatReset(rateLimit.reset)}` },
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
