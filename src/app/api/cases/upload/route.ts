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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'ข้อมูลฟอร์มไม่ถูกต้อง' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'ไม่พบไฟล์ที่ต้องการอัปโหลด' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // ตรวจสอบขนาดไฟล์ (สูงสุด 10MB ทั้งจาก metadata และ buffer จริง)
  if (file.size > MEDIA_MAX_SIZE_BYTES || buffer.length > MEDIA_MAX_SIZE_BYTES) {
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
