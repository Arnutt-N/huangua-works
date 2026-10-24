'use client';

import { payloadSummary } from '../reply-preview';
import type { Payload } from '../_lib/payload-utils';

/**
 * Live preview แบบเบา — ไม่ render flex เต็ม (หนักและ crash ง่ายกับ draft)
 * § ตาม jsk: preview ไม่ต้องสมบูรณ์แบบ แค่บอกว่า payload ใช้ได้หรือ "invalid flex"
 */
export function MessagePreview({
  objectType,
  payload,
  altText,
}: {
  objectType: string;
  payload: Payload;
  altText: string;
}) {
  if (objectType === 'text' || objectType === 'text_v2') {
    const text = typeof payload.text === 'string' ? payload.text : '';
    return (
      <div className="max-w-full rounded-xl bg-white px-3 py-2 text-sm text-ink shadow-sm">
        {text.trim() ? <span className="whitespace-pre-wrap">{text}</span> : 'ยังไม่มีข้อความ'}
      </div>
    );
  }

  if (objectType === 'image' || objectType === 'video') {
    const url = typeof payload.url === 'string' ? payload.url : '';
    if (!url) {
      return <Placeholder label={`ไม่มี ${objectType} url`} />;
    }
    // § preview ใช้ <img> ตรง ๆ (ไม่ผ่าน next/image) — url มาจากผู้ใช้และไม่ต้อง optimize
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={altText || 'ตัวอย่างรูป'} className="max-h-64 w-full rounded-xl object-contain" />
    );
  }

  // § ชนิดอื่น (flex/template/imagemap/sticker/...) — สรุป 1 บรรทัด ไม่เดาว่าจะ render อะไร
  const summary = payloadSummary(objectType, payload);
  if (summary === '—') {
    return <Placeholder label="invalid flex" />;
  }
  return (
    <div className="max-w-full rounded-xl bg-white/90 px-3 py-2 text-xs text-ink shadow-sm">
      <span className="font-semibold uppercase">{objectType}</span>
      <span className="ml-2 text-muted">{summary}</span>
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="rounded-xl bg-[#a9c6e8] px-3 py-2 text-sm font-medium text-[#2b3a4a]">
      {label}
    </div>
  );
}
