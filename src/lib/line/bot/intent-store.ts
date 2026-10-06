import { eq } from 'drizzle-orm';
import { getDb, type Tx } from '@/lib/db';
import { chatIntentKeywords, chatIntentResponses, chatIntents } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { bumpConfigVersion } from '../config-version';
import { invalidateIntentCache, validateRegex } from './intent-matcher';

/**
 * ทางเขียน intents ทางเดียว — ทุกการเขียนอยู่ใน transaction และประกาศการเปลี่ยนแปลงให้
 * บอททุก process เอง (ล้าง cache ของ process นี้ + INCR version ใน Redis)
 * route จึงไม่ต้องจำเรียก invalidate อีก
 */

export type IntentMatchType = 'exact' | 'starts_with' | 'contains' | 'regex';

export interface IntentKeywordInput {
  keyword: string;
  matchType: IntentMatchType;
}

export interface IntentResponseInput {
  replyType: 'text' | 'reply_object';
  textContent?: string | null;
  replyObjectId?: string | null;
  displayOrder: number;
}

export interface CreateIntentInput {
  name: string;
  description?: string | null;
  isActive: boolean;
  keywords: IntentKeywordInput[];
  responses: IntentResponseInput[];
}

export interface UpdateIntentInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  keywords?: IntentKeywordInput[];
  responses?: IntentResponseInput[];
}

export type IntentWriteResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'invalid_regex'; message: string };

function findRegexError(keywords: IntentKeywordInput[] | undefined): string | null {
  for (const kw of keywords ?? []) {
    if (kw.matchType !== 'regex') continue;
    const check = validateRegex(kw.keyword);
    if (!check.valid) return check.error ?? 'invalid regex';
  }
  return null;
}

async function replaceKeywords(tx: Tx, intentId: string, keywords: IntentKeywordInput[]) {
  await tx.delete(chatIntentKeywords).where(eq(chatIntentKeywords.intentId, intentId));
  if (keywords.length === 0) return;
  await tx.insert(chatIntentKeywords).values(
    keywords.map((kw) => ({
      id: generateId(),
      intentId,
      keyword: kw.keyword,
      matchType: kw.matchType,
    })),
  );
}

async function replaceResponses(tx: Tx, intentId: string, responses: IntentResponseInput[]) {
  await tx.delete(chatIntentResponses).where(eq(chatIntentResponses.intentId, intentId));
  if (responses.length === 0) return;
  await tx.insert(chatIntentResponses).values(
    responses.map((r) => ({
      id: generateId(),
      intentId,
      replyType: r.replyType,
      textContent: r.textContent ?? null,
      replyObjectId: r.replyObjectId ?? null,
      displayOrder: r.displayOrder,
    })),
  );
}

async function publishIntentChange(): Promise<void> {
  invalidateIntentCache();
  await bumpConfigVersion('intents');
}

export async function createIntent(input: CreateIntentInput): Promise<IntentWriteResult> {
  const regexError = findRegexError(input.keywords);
  if (regexError) return { ok: false, reason: 'invalid_regex', message: regexError };

  const id = generateId();
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.insert(chatIntents).values({
      id,
      name: input.name,
      description: input.description ?? null,
      isActive: input.isActive,
    });
    await replaceKeywords(tx, id, input.keywords);
    await replaceResponses(tx, id, input.responses);
  });

  await publishIntentChange();
  return { ok: true, id };
}

export async function updateIntent(id: string, patch: UpdateIntentInput): Promise<IntentWriteResult> {
  const regexError = findRegexError(patch.keywords);
  if (regexError) return { ok: false, reason: 'invalid_regex', message: regexError };

  const { name, description, isActive, keywords, responses } = patch;
  const db = await getDb();

  // § ทั้งก้อนต้องอยู่ใน transaction เดียว — เดิมลบ keyword/response แล้ว insert ใหม่นอก
  // transaction ถ้า insert พัง (เช่น replyObjectId ที่ไม่มีจริงชน FK) intent จะเหลือ keyword
  // หรือคำตอบศูนย์ตัวค้างไว้ และบอทจะเงียบกับคำถามนั้นโดยไม่มีใครรู้
  const found = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: chatIntents.id })
      .from(chatIntents)
      .where(eq(chatIntents.id, id))
      .for('update');
    if (!existing) return false;

    await tx
      .update(chatIntents)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        updatedAt: new Date(),
      })
      .where(eq(chatIntents.id, id));

    if (keywords) await replaceKeywords(tx, id, keywords);
    if (responses) await replaceResponses(tx, id, responses);
    return true;
  });

  if (!found) return { ok: false, reason: 'not_found' };
  await publishIntentChange();
  return { ok: true, id };
}

export async function deleteIntent(id: string): Promise<IntentWriteResult> {
  const db = await getDb();
  // keywords/responses หายตามด้วย onDelete: 'cascade'
  const deleted = await db
    .delete(chatIntents)
    .where(eq(chatIntents.id, id))
    .returning({ id: chatIntents.id });
  if (deleted.length === 0) return { ok: false, reason: 'not_found' };

  await publishIntentChange();
  return { ok: true, id };
}
