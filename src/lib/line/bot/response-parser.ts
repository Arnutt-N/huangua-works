import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatReplyObjects } from '@/lib/db/schema';
import type { LineOutgoingMessage, LineQuickReply, LineQuickReplyItem } from '../types';

const OBJECT_REF_PATTERN = /\$object_id:([\w-]+)/g;

export async function resolveObjectRef(objectId: string): Promise<LineOutgoingMessage | null> {
  const db = await getDb();
  const [obj] = await db
    .select()
    .from(chatReplyObjects)
    .where(and(eq(chatReplyObjects.objectId, objectId), eq(chatReplyObjects.isActive, true)))
    .limit(1);

  if (!obj) return null;

  return buildMessageFromObject(obj.objectType, obj.payload as Record<string, unknown>, obj.altText);
}

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
    case 'text_v2':
      return { type: 'text', text: String(body.text ?? altText ?? '') };
    case 'flex':
      return { type: 'flex', altText: altText ?? 'ข้อความ', contents: body };
    case 'template':
      return { type: 'template', altText: altText ?? 'เมนู', template: body };
    case 'image':
      return {
        type: 'image',
        originalContentUrl: String(body.url ?? ''),
        previewImageUrl: String(body.previewUrl ?? body.url ?? ''),
      };
    case 'sticker':
      if (body.packageId === undefined || body.stickerId === undefined) return null;
      return {
        type: 'sticker',
        packageId: String(body.packageId),
        stickerId: String(body.stickerId),
      };
    case 'video':
      if (body.url === undefined) return null;
      return {
        type: 'video',
        originalContentUrl: String(body.url),
        previewImageUrl: String(body.previewUrl ?? body.url),
      };
    case 'audio':
      if (body.url === undefined) return null;
      return {
        type: 'audio',
        originalContentUrl: String(body.url),
        duration: Number(body.duration ?? 0),
      };
    case 'location':
      if (body.latitude === undefined || body.longitude === undefined) return null;
      return {
        type: 'location',
        title: String(body.title ?? 'ตำแหน่ง'),
        address: String(body.address ?? ''),
        latitude: Number(body.latitude),
        longitude: Number(body.longitude),
      };
    case 'imagemap': {
      const baseSize = body.baseSize as { width?: unknown; height?: unknown } | undefined;
      if (body.baseUrl === undefined || baseSize?.width === undefined || baseSize?.height === undefined) return null;
      return {
        type: 'imagemap',
        baseUrl: String(body.baseUrl),
        altText: altText ?? 'รูปภาพ',
        baseSize: { width: Number(baseSize.width), height: Number(baseSize.height) },
        actions: Array.isArray(body.actions) ? body.actions : [],
      };
    }
    default:
      return null;
  }
}

/** เพดาน items ของ quickReply ต่อข้อความ (โควตา LINE Messaging API) */
const LINE_QUICK_REPLY_MAX_ITEMS = 13;

/** quickReply เก็บใน payload ({ items: [...] }) — ผิดรูปถือว่าไม่มี ไม่พังทั้งข้อความ */
function parseQuickReply(value: unknown): LineQuickReply | null {
  if (!value || typeof value !== 'object') return null;
  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length === 0 || items.length > LINE_QUICK_REPLY_MAX_ITEMS) return null;
  const valid = items.filter((item): item is LineQuickReplyItem => {
    if (!item || typeof item !== 'object') return false;
    const action = (item as { action?: unknown }).action;
    if (!action || typeof action !== 'object') return false;
    const type = (action as { type?: unknown }).type;
    return type === 'message' || type === 'postback' || type === 'uri';
  });
  if (valid.length === 0) return null;
  return { items: valid };
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

  if (messages.length === 0) messages.push({ type: 'text', text });

  return messages;
}
