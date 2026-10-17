import type { LineOutgoingMessage } from '../types';
import { parseQuickReply } from '../reply-object-validation';
import { resolveObjectRef } from './reply-object-store';

const OBJECT_REF_PATTERN = /\$object_id:([\w-]+)/g;

/** pure builder — test ได้โดยไม่ต้องมี DB (resolveObjectRef เป็นแค่ boundary อ่านแถว) */
export function buildMessageFromObject(
  objectType: string,
  payload: Record<string, unknown>,
  altText: string | null,
): LineOutgoingMessage | null {
  // § quickReply เป็น modifier ท้ายข้อความ ใช้ได้ทุก type — derive จาก payload ไม่สร้าง state แยก
  // แนบครั้งเดียวตรงนี้ ไม่ spread ตาม case (ทุก variant มี quickReply? อยู่แล้ว)
  const base = buildBaseMessage(objectType, payload, altText);
  if (!base) return null;
  const quickReply = parseQuickReply(payload.quickReply);
  if (quickReply) base.quickReply = quickReply;
  return base;
}

function buildBaseMessage(
  objectType: string,
  payload: Record<string, unknown>,
  altText: string | null,
): LineOutgoingMessage | null {
  // § quickReply อยู่ใน payload ตาม convention เดียวกัน — ต้องแยกออกก่อนส่ง contents/template
  // ไม่เช่นนั้น blob quickReply รั่วเข้า Flex body แล้ว LINE อาจ reject ทั้งชุด
  const { quickReply: _ignored, ...body } = payload;
  switch (objectType) {
    case 'text':
    case 'text_v2': {
      const text = String(body.text ?? altText ?? '');
      if (!text) return null;
      return { type: 'text', text };
    }
    case 'flex':
      return { type: 'flex', altText: altText ?? 'ข้อความ', contents: body };
    case 'template':
      return { type: 'template', altText: altText ?? 'เมนู', template: body };
    case 'image': {
      const url = String(body.url ?? '');
      if (!url) return null;
      return {
        type: 'image',
        originalContentUrl: url,
        previewImageUrl: String(body.previewUrl || url),
      };
    }
    case 'sticker': {
      const packageId = String(body.packageId ?? '');
      const stickerId = String(body.stickerId ?? '');
      if (!packageId || !stickerId) return null;
      return { type: 'sticker', packageId, stickerId };
    }
    case 'video': {
      const url = String(body.url ?? '');
      if (!url) return null;
      return {
        type: 'video',
        originalContentUrl: url,
        previewImageUrl: String(body.previewUrl || url),
      };
    }
    case 'audio': {
      const url = String(body.url ?? '');
      const duration = Number(body.duration ?? 0);
      if (!url || !Number.isFinite(duration) || duration < 0) return null;
      return { type: 'audio', originalContentUrl: url, duration };
    }
    case 'location': {
      const latitude = Number(body.latitude);
      const longitude = Number(body.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return null;
      }
      return {
        type: 'location',
        title: String(body.title ?? 'ตำแหน่ง'),
        address: String(body.address ?? ''),
        latitude,
        longitude,
      };
    }
    case 'imagemap': {
      const baseSize = body.baseSize as { width?: unknown; height?: unknown } | undefined;
      const width = Number(baseSize?.width);
      const height = Number(baseSize?.height);
      const baseUrl = String(body.baseUrl ?? '');
      if (!baseUrl || !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return null;
      return {
        type: 'imagemap',
        baseUrl,
        altText: altText ?? 'รูปภาพ',
        baseSize: { width, height },
        actions: Array.isArray(body.actions) ? body.actions : [],
      };
    }
    default:
      return null;
  }
}

export async function parseResponseText(text: string): Promise<LineOutgoingMessage[]> {
  const messages: LineOutgoingMessage[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(OBJECT_REF_PATTERN)) {
    const before = text.slice(lastIndex, match.index).trim();
    if (before) messages.push({ type: 'text', text: before });

    const resolved = await resolveObjectRef(match[1]!);
    if (resolved) {
      messages.push(resolved);
    } else {
      console.warn(`[response-parser] $object_id:${match[1]} not found or inactive`);
    }

    lastIndex = match.index! + match[0].length;
  }

  const remaining = text.slice(lastIndex).trim();
  if (remaining) messages.push({ type: 'text', text: remaining });

  // § ref แก้ไม่ได้ต้องไม่รั่วถึงประชาชน — เหลืออากาศเปล่าๆ ส่งข้อความกลางแทน (log อยู่ข้างบน)
  if (messages.length === 0) {
    messages.push({ type: 'text', text: 'ขออภัยครับ ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง' });
  }

  return messages;
}
