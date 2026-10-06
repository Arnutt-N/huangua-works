import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatIntents, chatIntentKeywords, chatIntentResponses, chatReplyObjects } from '@/lib/db/schema';
import type { LineOutgoingMessage } from '../types';
import { readConfigVersion } from '../config-version';
import {
  BOT_CONFIG_TTL_MS,
  BOT_CONFIG_VERSION_CHECK_MS,
  createVersionedCache,
} from '../versioned-cache';

export interface IntentMatch {
  intentId: string;
  intentName: string;
  responses: LineOutgoingMessage[];
}

const REGEX_CAP = 256;
const regexCache = new Map<string, RegExp | null>();

function compileRegex(pattern: string): RegExp | null {
  if (pattern.length > REGEX_CAP) return null;
  const cached = regexCache.get(pattern);
  if (cached !== undefined) return cached;
  try {
    const re = new RegExp(pattern, 'i');
    regexCache.set(pattern, re);
    return re;
  } catch {
    regexCache.set(pattern, null);
    return null;
  }
}

export function validateRegex(pattern: string): { valid: boolean; error?: string } {
  if (pattern.length > REGEX_CAP) return { valid: false, error: `เกิน ${REGEX_CAP} ตัวอักษร` };
  try {
    new RegExp(pattern);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'invalid regex' };
  }
}

interface KeywordRow {
  keyword: string;
  matchType: string;
  intentId: string;
  intentName: string;
}

async function loadActiveKeywords(): Promise<KeywordRow[]> {
  const db = await getDb();
  return db
    .select({
      keyword: chatIntentKeywords.keyword,
      matchType: chatIntentKeywords.matchType,
      intentId: chatIntents.id,
      intentName: chatIntents.name,
    })
    .from(chatIntentKeywords)
    .innerJoin(chatIntents, eq(chatIntentKeywords.intentId, chatIntents.id))
    .where(eq(chatIntents.isActive, true));
}

// § cache นี้เห็นการแก้ไขจาก admin process อื่นผ่านเลข version ใน Redis (scope 'intents')
// ดู config-version.ts — Redis ล่มก็ยังมี TTL 60 วินาทีแบบเดิม
const keywordCache = createVersionedCache<KeywordRow[]>({
  load: loadActiveKeywords,
  readVersion: () => readConfigVersion('intents'),
  ttlMs: BOT_CONFIG_TTL_MS,
  versionCheckMs: BOT_CONFIG_VERSION_CHECK_MS,
});

/** ผู้เรียกเดียวคือ intent-store.ts — route ไม่ต้องจำเรียกเองแล้ว */
export function invalidateIntentCache(): void {
  keywordCache.invalidate();
}

const MATCH_PRIORITY: Record<string, number> = {
  exact: 0,
  starts_with: 1,
  contains: 2,
  regex: 3,
};

export async function matchIntent(text: string): Promise<IntentMatch | null> {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;

  const keywords = await keywordCache.get();

  let bestIntentId: string | null = null;
  let bestIntentName = '';
  let bestPriority = Infinity;

  for (const row of keywords) {
    const kw = row.keyword.toLowerCase();
    let matched = false;

    switch (row.matchType) {
      case 'exact':
        matched = normalized === kw;
        break;
      case 'starts_with':
        matched = normalized.startsWith(kw);
        break;
      case 'contains':
        matched = normalized.includes(kw);
        break;
      case 'regex': {
        const re = compileRegex(row.keyword);
        matched = re ? re.test(normalized) : false;
        break;
      }
    }

    if (matched) {
      const priority = MATCH_PRIORITY[row.matchType] ?? 99;
      if (priority < bestPriority) {
        bestPriority = priority;
        bestIntentId = row.intentId;
        bestIntentName = row.intentName;
      }
    }
  }

  if (!bestIntentId) return null;

  const responses = await resolveIntentResponses(bestIntentId);
  if (responses.length === 0) return null;

  return { intentId: bestIntentId, intentName: bestIntentName, responses };
}

async function resolveIntentResponses(intentId: string): Promise<LineOutgoingMessage[]> {
  const db = await getDb();
  const rows = await db
    .select({
      replyType: chatIntentResponses.replyType,
      textContent: chatIntentResponses.textContent,
      replyObjectId: chatIntentResponses.replyObjectId,
    })
    .from(chatIntentResponses)
    .where(and(eq(chatIntentResponses.intentId, intentId), eq(chatIntentResponses.isActive, true)))
    .orderBy(chatIntentResponses.displayOrder);

  const messages: LineOutgoingMessage[] = [];

  for (const row of rows) {
    if (row.replyType === 'text' && row.textContent) {
      messages.push({ type: 'text', text: row.textContent });
    } else if (row.replyType === 'reply_object' && row.replyObjectId) {
      const msg = await resolveReplyObject(row.replyObjectId);
      if (msg) messages.push(msg);
    }
  }

  return messages;
}

async function resolveReplyObject(objectId: string): Promise<LineOutgoingMessage | null> {
  const db = await getDb();
  const [obj] = await db
    .select()
    .from(chatReplyObjects)
    .where(and(eq(chatReplyObjects.id, objectId), eq(chatReplyObjects.isActive, true)))
    .limit(1);

  if (!obj) return null;

  const payload = obj.payload as Record<string, unknown>;

  switch (obj.objectType) {
    case 'text':
      return { type: 'text', text: String(payload.text ?? obj.altText ?? '') };
    case 'flex':
      return {
        type: 'flex',
        altText: obj.altText ?? 'ข้อความ',
        contents: payload,
      } as LineOutgoingMessage;
    case 'template':
      return {
        type: 'template',
        altText: obj.altText ?? 'เมนู',
        template: payload,
      } as LineOutgoingMessage;
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
