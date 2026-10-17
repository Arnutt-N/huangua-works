import { z } from 'zod';

/** ประเภท reply object ทั้งหมด (ตรงกับ replyObjectTypeEnum ใน schema) */
export const REPLY_OBJECT_TYPES = [
  'flex',
  'template',
  'text',
  'text_v2',
  'image',
  'sticker',
  'video',
  'audio',
  'location',
  'imagemap',
] as const;

export type ReplyObjectType = (typeof REPLY_OBJECT_TYPES)[number];

export const replyObjectTypeSchema = z.enum(REPLY_OBJECT_TYPES);

/** field ที่แต่ละ type ต้องมีใน payload — กฎเดียวกับ client ใช้ร่วมกันทั้งสองฝั่ง */
const REQUIRED_PAYLOAD_FIELDS: Record<ReplyObjectType, string[]> = {
  flex: [],
  template: [],
  text: ['text'],
  text_v2: ['text'],
  image: ['url'],
  sticker: ['packageId', 'stickerId'],
  video: ['url'],
  audio: ['url'],
  location: ['latitude', 'longitude'],
  imagemap: ['baseUrl', 'baseSize'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * ตรวจ payload ตาม type ที่ boundary (server route + client form ใช้ฟังก์ชันเดียวกัน)
 * คืนข้อความผิดภาษาไทย หรือ null ถ้าผ่าน
 */
export function validateReplyPayload(
  objectType: string,
  payload: unknown,
): string | null {
  if (!(REPLY_OBJECT_TYPES as readonly string[]).includes(objectType)) {
    return `ประเภทไม่รองรับ: ${objectType}`;
  }
  if (!isRecord(payload)) return 'payload ต้องเป็น object';
  const type = objectType as ReplyObjectType;
  const missing = REQUIRED_PAYLOAD_FIELDS[type].filter((field) => payload[field] === undefined || payload[field] === null);
  if (missing.length > 0) return `payload ขาด field ที่จำเป็นสำหรับ ${type}: ${missing.join(', ')}`;
  if (type === 'imagemap') {
    const baseSize = payload.baseSize;
    if (!isRecord(baseSize) || baseSize.width === undefined || baseSize.height === undefined) {
      return 'payload.baseSize ต้องมี width และ height';
    }
  }
  if (type === 'location') {
    const lat = Number(payload.latitude);
    const lng = Number(payload.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return 'พิกัดไม่ถูกต้อง (lat ±90, lng ±180)';
    }
  }
  if (type === 'audio') {
    const duration = Number(payload.duration ?? 0);
    if (!Number.isFinite(duration) || duration < 0) return 'duration ต้องเป็นตัวเลขไม่ติดลบ';
  }
  const quickReply = payload.quickReply;
  if (quickReply !== undefined) {
    if (!isRecord(quickReply) || !Array.isArray(quickReply.items)) return 'quickReply ต้องมี items เป็น array';
    if (quickReply.items.length === 0 || quickReply.items.length > 13) {
      return 'quickReply ต้องมี 1-13 items';
    }
  }
  return null;
}
