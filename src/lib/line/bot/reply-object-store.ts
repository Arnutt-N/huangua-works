import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatReplyObjects } from '@/lib/db/schema';
import type { LineOutgoingMessage } from '../types';
import { buildMessageFromObject } from './response-parser';

/**
 * จุดอ่านแถว reply object จุดเดียว — แยกแค่คีย์ค้น (slug objectId หรือ PK id)
 * ห้าม query chatReplyObjects ที่อื่น (เคย drift มาแล้ว) builder อยู่ response-parser
 */
export async function loadReplyObject(
  by: { objectId: string } | { id: string },
): Promise<LineOutgoingMessage | null> {
  const db = await getDb();
  const cond = 'objectId' in by
    ? eq(chatReplyObjects.objectId, by.objectId)
    : eq(chatReplyObjects.id, by.id);
  const [obj] = await db
    .select()
    .from(chatReplyObjects)
    .where(and(cond, eq(chatReplyObjects.isActive, true)))
    .limit(1);
  if (!obj) return null;
  return buildMessageFromObject(obj.objectType, obj.payload as Record<string, unknown>, obj.altText);
}

/** ref แบบ $object_id:slug ในข้อความตอบกลับ */
export function resolveObjectRef(objectId: string): Promise<LineOutgoingMessage | null> {
  return loadReplyObject({ objectId });
}

/** intent response ที่ผูกด้วย PK id */
export function resolveReplyObject(id: string): Promise<LineOutgoingMessage | null> {
  return loadReplyObject({ id });
}
