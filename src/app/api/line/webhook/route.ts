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

// § 1 MiB — ข้อความ LINE จริงเล็กกว่านี้มาก แต่ลายเซ็นต้องอ่านทั้งก้อน
// จึงต้องตัดก่อนที่ request ไม่มีลายเซ็นจะบังคับให้โปรเซสถือ body ใหญ่ได้
const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;

function tooLarge(): NextResponse {
  return NextResponse.json({ message: 'Request body too large' }, { status: 413 });
}

/** อ่าน body ไม่เกิน 1 MiB แล้วถอด UTF-8 แบบไม่แทนที่ไบต์พัง */
async function readWebhookBody(
  request: Request,
): Promise<{ ok: true; text: string } | { ok: false; response: NextResponse }> {
  const declared = request.headers.get('content-length');
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) {
      return {
        ok: false,
        response: NextResponse.json({ message: 'Invalid Content-Length' }, { status: 400 }),
      };
    }
    if (Number(declared) > MAX_WEBHOOK_BODY_BYTES) return { ok: false, response: tooLarge() };
  }

  const reader = request.body?.getReader();
  if (!reader) return { ok: true, text: '' };

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_WEBHOOK_BODY_BYTES) {
      await reader.cancel();
      return { ok: false, response: tooLarge() };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ message: 'Invalid request body encoding' }, { status: 400 }),
    };
  }
}

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
  const read = await readWebhookBody(request);
  if (!read.ok) return read.response;
  const body = read.text;
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

  // § body ผ่าน signature แล้วแต่ parse ไม่ได้/ไม่มี events array = request ผิดรูป → 400 ตามความหมาย
  // (ไม่ปล่อย JSON.parse throw เป็น 500 ปน error จริงใน log) — หมายเหตุ: LINE redeliver ทุกสถานะ
  // ที่ไม่ใช่ 2xx เมื่อเปิด webhook redelivery 400 จึงไม่ได้กัน redeliver
  let parsed: LineWebhookRequestBody;
  try {
    parsed = JSON.parse(body) as LineWebhookRequestBody;
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }
  if (!parsed || !Array.isArray(parsed.events)) {
    return NextResponse.json({ message: 'Invalid webhook payload' }, { status: 400 });
  }

  await Promise.all(
    parsed.events.map(async (event) => {
      // § event ผิดรูป (null/ไม่ใช่ object) ข้ามทีละตัว และ dedup อยู่ใน try ด้วย —
      // message event ที่ไม่มี .message ทำ lineMessageIdOf throw ได้ ห้ามลามเป็น 500 ทั้ง batch
      if (!event || typeof event !== 'object') return;
      try {
        if (await isDuplicateEvent(event)) return;
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
