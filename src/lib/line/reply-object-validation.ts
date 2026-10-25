import { z } from 'zod';
import { findActionUriViolation, URI_SCHEME_ERROR_TH } from '@/lib/contracts';
import type { LineQuickReply, LineQuickReplyItem } from './types';

/**
 * tuple เดียวของ reply object types — pgEnum, zod schema ฝั่ง server,
 * และ dropdown ฝั่ง client derive จากที่นี่ ห้าม hardcode รายชื่อที่อื่น
 */
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

/** เพดาน items ของ quickReply ต่อข้อความ (โควตา LINE Messaging API) */
export const LINE_QUICK_REPLY_MAX_ITEMS = 13;

const quickReplyActionSchema = z.union([
  z.object({ type: z.literal('message'), label: z.string().min(1).max(20), text: z.string().min(1) }),
  z.object({ type: z.literal('postback'), label: z.string().min(1).max(20), data: z.string().min(1), displayText: z.string().optional() }),
  z.object({ type: z.literal('uri'), label: z.string().min(1).max(20), uri: z.string().url() }),
]);

const quickReplySchema = z.object({
  items: z.array(z.object({ type: z.literal('action'), action: quickReplyActionSchema })).min(1).max(LINE_QUICK_REPLY_MAX_ITEMS),
});

/** schema ต่อ type — ความจริงเดียวของรูปร่าง payload ที่ถูกต้อง (เข้มเท่า LINE รับ ไม่ใช่แค่รูปทรง) */
const httpsUrl = z.string().url().refine((u) => u.startsWith('https://'), 'ต้องเป็น https URL (LINE ไม่รับ http)');
const PAYLOAD_SCHEMAS = {
  flex: z.record(z.string(), z.unknown()).refine((v) => Object.keys(v).length > 0, 'payload ต้องไม่ว่าง'),
  template: z.record(z.string(), z.unknown()).refine((v) => Object.keys(v).length > 0, 'payload ต้องไม่ว่าง'),
  text: z.object({ text: z.string().min(1) }),
  text_v2: z.object({ text: z.string().min(1) }),
  image: z.object({ url: httpsUrl, previewUrl: httpsUrl.optional() }),
  sticker: z.object({ packageId: z.string().min(1), stickerId: z.string().min(1) }),
  video: z.object({ url: httpsUrl, previewUrl: httpsUrl.optional() }),
  audio: z.object({ url: httpsUrl, duration: z.number().positive() }),
  location: z.object({
    title: z.string().min(1),
    address: z.string().min(1),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  imagemap: z.object({
    baseUrl: httpsUrl,
    baseSize: z.object({ width: z.number().positive(), height: z.number().positive() }),
    actions: z.array(z.record(z.string(), z.unknown())).min(1, 'imagemap ต้องมี action อย่างน้อย 1'),
  }),
} satisfies Record<ReplyObjectType, z.ZodTypeAny>;

export type ParsedReplyPayload = {
  [K in ReplyObjectType]: z.infer<(typeof PAYLOAD_SCHEMAS)[K]>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * แยก quickReply ออกจาก body — เจ้าของกฎนี้ตัวเดียว ทั้ง validator และ builder ใช้
 * คืน null เมื่อ quickReply ผิดรูป (ห้ามกลืนเงียบ ห้ามส่งแบบแหว่ง)
 */
export function parseQuickReply(value: unknown): LineQuickReply | null {
  if (value === undefined) return null;
  const parsed = quickReplySchema.safeParse(value);
  if (!parsed.success) return null;
  return { items: parsed.data.items as LineQuickReplyItem[] };
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
  const type = objectType as ReplyObjectType;
  if (!isRecord(payload)) return 'payload ต้องเป็น object';
  const { quickReply: _ignored, ...body } = payload;
  const result = PAYLOAD_SCHEMAS[type].safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    return first?.message ?? `payload ไม่ถูกต้องสำหรับ ${type}`;
  }
  if (payload.quickReply !== undefined && parseQuickReply(payload.quickReply) === null) {
    return 'quickReply ไม่ถูกต้อง (ต้องมี 1-13 items ที่ action ถูกต้อง)';
  }
  // § scheme ของ action uri ต้องบังคับที่ server — z.string().url() รับ javascript:/data: ผ่าน
  const badUri = findActionUriViolation(payload);
  if (badUri !== null) return `${URI_SCHEME_ERROR_TH} (${badUri})`;
  return null;
}
