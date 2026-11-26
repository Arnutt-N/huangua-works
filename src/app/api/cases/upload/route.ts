/**
 * POST /api/cases/upload — อัปโหลดรูปภาพหลักฐานประกอบเรื่องร้องเรียนของประชาชน
 *
 * § Endpoint สาธารณะ ไม่ต้อง Login — ต้องจำกัดประเภทและขนาดไฟล์อย่างเข้มงวด
 * § ตรวจสอบ Magic bytes จริงฝั่งเซิร์ฟเวอร์เสมอ ไม่เชื่อ Content-Type ที่ client ส่งมา
 * § Key ใน bucket อยู่ใน prefix 'cases/attachments/' ซึ่งตรงกับ keyFromUrl() ใน src/lib/cases/intake.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateId } from '@/lib/id';
import { uploadFile, isStorageConfigured } from '@/lib/storage';
import { enforceRateLimit } from '@/lib/rate-limit/enforce';
import { formatReset } from '@/lib/rate-limit/format-reset';
import { clientIpFromHeaders } from '@/lib/rate-limit/client-ip';
import {
  MEDIA_ALLOWED_MIME,
  MEDIA_MAX_SIZE_BYTES,
  MEDIA_SIZE_ERROR,
  MEDIA_TYPE_ERROR,
  sniffImageMime,
} from '@/lib/media-upload-rules';

export { sniffImageMime };

/** § เผื่อ boundary, filename, Content-Type และ CRLF ของ multipart ให้ไฟล์ที่เพดานพอดีผ่าน ingress */
const MULTIPART_OVERHEAD_BYTES = 4 * 1024;
/** § part จำนวนมากทำให้ parsing ใช้ memory ทั้งที่ต้องการจริงแค่ file part เดียว */
const MAX_FORM_PARTS = 4;

function tooLarge(): NextResponse {
  return NextResponse.json({ error: MEDIA_SIZE_ERROR }, { status: 413 });
}

/** § อ่าน body จริงก่อน parse — header เป็นตัวกรองคร่าวๆ แต่ chunked upload ไม่มี header */
async function readBoundedBody(
  req: NextRequest,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; response: NextResponse }> {
  const limit = MEDIA_MAX_SIZE_BYTES + MULTIPART_OVERHEAD_BYTES;
  const declared = req.headers.get('content-length');
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Content-Length ไม่ถูกต้อง' }, { status: 400 }),
      };
    }
    if (Number(declared) > limit) return { ok: false, response: tooLarge() };
  }

  const reader = req.body?.getReader();
  if (!reader) return { ok: true, bytes: new Uint8Array() };

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > limit) {
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
  return { ok: true, bytes };
}

export async function POST(req: NextRequest) {
  const ip = clientIpFromHeaders(req.headers);

  // § Rate limit — 10 ไฟล์ / 5 นาที ต่อ IP (fail-open บริการประชาชน)
  const rateLimit = await enforceRateLimit('caseUpload', ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'อัปโหลดไฟล์ถี่เกินไป กรุณารอ ' + formatReset(rateLimit.reset) },
      { status: 429 }
    );
  }

  // § ตรวจสอบความพร้อมของ Object Storage
  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: 'ระบบจัดเก็บไฟล์ยังไม่เปิดใช้งานในขณะนี้' },
      { status: 503 }
    );
  }

  const body = await readBoundedBody(req);
  if (!body.ok) return body.response;

  let formData: FormData;
  try {
    // § parse จาก bytes ที่จำกัดขนาดแล้ว ไม่ใช่ stream ดิบ — ป้องกัน chunked ที่โกหก header
    const bounded = new Request(req.url, {
      method: 'POST',
      headers: { 'content-type': req.headers.get('content-type') ?? '' },
      body: new Blob([new Uint8Array(body.bytes).buffer as ArrayBuffer]),
    });
    formData = await bounded.formData();
  } catch {
    return NextResponse.json({ error: 'ข้อมูลฟอร์มไม่ถูกต้อง' }, { status: 400 });
  }

  if ([...formData.keys()].length > MAX_FORM_PARTS) {
    return NextResponse.json({ error: 'ข้อมูลฟอร์มมีส่วนเกินกำหนด' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'ไม่พบไฟล์ที่ต้องการอัปโหลด' }, { status: 400 });
  }

  // § ปฏิเสธจาก metadata ก่อน materialize — ไฟล์ 11MB ต้องไม่ถูกอ่านเข้ามาใน memory เลย
  if (file.size > MEDIA_MAX_SIZE_BYTES) {
    return NextResponse.json({ error: MEDIA_SIZE_ERROR }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // ตรวจสอบขนาด buffer จริงเป็นแนวป้องกันที่สอง (metadata อาจไม่ตรงกับเนื้อหา)
  if (buffer.length > MEDIA_MAX_SIZE_BYTES) {
    return NextResponse.json({ error: MEDIA_SIZE_ERROR }, { status: 413 });
  }

  const sniffed = sniffImageMime(buffer);

  // ตรวจสอบทั้ง Content-Type ของ Browser และ Magic bytes ของไบนารีจริง
  if (!sniffed || !MEDIA_ALLOWED_MIME[file.type]) {
    return NextResponse.json({ error: MEDIA_TYPE_ERROR }, { status: 415 });
  }

  const id = generateId();
  const key = `cases/attachments/${id}.${sniffed.ext}`;

  try {
    const url = await uploadFile(key, buffer, sniffed.mime);

    return NextResponse.json(
      {
        ok: true,
        id,
        url,
        key,
        type: sniffed.mime,
        size: file.size,
        name: file.name,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: 'อัปโหลดไฟล์ไปยังระบบจัดเก็บไม่สำเร็จ กรุณาลองใหม่' },
      { status: 500 }
    );
  }
}
