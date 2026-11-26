import { NextResponse } from 'next/server';
import { verifyLineSignature } from '@/lib/line/signature';
import { processWebhookEvents } from '@/lib/line/bot/engine';
import { enqueueWebhookEvent } from '@/lib/line/webhook-events';
import { enforceRateLimit } from '@/lib/rate-limit/enforce';
import { formatReset } from '@/lib/rate-limit/format-reset';
import { clientIpFromHeaders } from '@/lib/rate-limit/client-ip';
import { parseWebhookEvent, type LineWebhookRequestBody } from '@/lib/line/types';

export const runtime = 'nodejs';

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
  // (ไม่ปล่อย JSON.parse throw เป็น 500 ปน error จริงใน log)
  let parsed: LineWebhookRequestBody;
  try {
    parsed = JSON.parse(body) as LineWebhookRequestBody;
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }
  if (!parsed || !Array.isArray(parsed.events)) {
    return NextResponse.json({ message: 'Invalid webhook payload' }, { status: 400 });
  }

  // § กรองที่ขอบเขตก่อน insert — event นอกขอบเขต (group/room, ต่าง type, timestamp พัง)
  // ต้องไม่ทำให้ทั้ง batch 500; นับแยกอีก counter ให้เห็นว่ามี event ถูกข้าม
  const supported: Parameters<typeof enqueueWebhookEvent>[0][] = [];
  const ignored: Record<string, number> = {};
  for (const raw of parsed.events) {
    const result = parseWebhookEvent(raw);
    if (result.kind === 'supported') {
      supported.push(result.event);
    } else {
      ignored[result.reason] = (ignored[result.reason] ?? 0) + 1;
    }
  }
  const ignoredCount = Object.values(ignored).reduce((sum, n) => sum + n, 0);
  if (ignoredCount > 0) {
    // § log แบบ bounded: แจ้งเหตุผล+จำนวน ไม่ log payload (ข้อความร้องเรียน/PII)
    console.warn('[line-webhook] ignored events', { count: ignoredCount, reasons: ignored });
  }

  // § เฉพาะ event ที่รองรับเท่านั้นที่ persistence failure → 500 ให้ LINE redeliver
  const results = await Promise.all(
    supported.map(async (event) => {
      try {
        return await enqueueWebhookEvent(event);
      } catch (error) {
        return { ok: false, error };
      }
    }),
  );
  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    console.error('[line-webhook] enqueue failed', { count: failures.length });
    return NextResponse.json({ message: 'Failed to store webhook events' }, { status: 500 });
  }

  // § inline processing ตาม timestamp แล้ว id (processWebhookEvents จัดลำดับให้)
  const outcome = supported.length > 0 ? await processWebhookEvents(supported.length) : null;
  return NextResponse.json({ ok: true, ignored: ignoredCount, ...outcome });
}
