import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatReplyObjects } from '@/lib/db/schema';
import type { LineOutgoingMessage } from '../types';

const OBJECT_REF_PATTERN = /\$object_id:([\w-]+)/g;

export async function resolveObjectRef(objectId: string): Promise<LineOutgoingMessage | null> {
  const db = await getDb();
  const [obj] = await db
    .select()
    .from(chatReplyObjects)
    .where(and(eq(chatReplyObjects.objectId, objectId), eq(chatReplyObjects.isActive, true)))
    .limit(1);

  if (!obj) return null;

  const payload = obj.payload as Record<string, unknown>;

  switch (obj.objectType) {
    case 'text':
      return { type: 'text', text: String(payload.text ?? obj.altText ?? '') };
    case 'flex':
      return { type: 'flex', altText: obj.altText ?? 'ข้อความ', contents: payload } as LineOutgoingMessage;
    case 'template':
      return { type: 'template', altText: obj.altText ?? 'เมนู', template: payload } as LineOutgoingMessage;
    case 'image':
      return {
        type: 'image',
        originalContentUrl: String(payload.url ?? ''),
        previewImageUrl: String(payload.previewUrl ?? payload.url ?? ''),
      } as LineOutgoingMessage;
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

  if (messages.length === 0) messages.push({ type: 'text', text });

  return messages;
}
