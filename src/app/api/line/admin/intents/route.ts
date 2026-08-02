import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatIntents, chatIntentKeywords, chatIntentResponses } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { invalidateIntentCache, validateRegex } from '@/lib/line/bot/intent-matcher';
import { parseBody } from '@/lib/api-helpers';
import { z } from 'zod';

export const runtime = 'nodejs';

const keywordSchema = z.object({
  keyword: z.string().min(1).max(256),
  matchType: z.enum(['exact', 'starts_with', 'contains', 'regex']).default('contains'),
});

const responseSchema = z.object({
  replyType: z.enum(['text', 'reply_object']).default('text'),
  textContent: z.string().max(2000).nullable().optional(),
  replyObjectId: z.string().nullable().optional(),
  displayOrder: z.number().int().min(0).default(0),
});

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
  keywords: z.array(keywordSchema).min(1).max(50),
  responses: z.array(responseSchema).min(1).max(10),
});

export async function GET() {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const db = await getDb();
  const intents = await db.select().from(chatIntents).orderBy(asc(chatIntents.name));

  const items = await Promise.all(
    intents.map(async (intent) => {
      const keywords = await db
        .select()
        .from(chatIntentKeywords)
        .where(eq(chatIntentKeywords.intentId, intent.id))
        .orderBy(asc(chatIntentKeywords.createdAt));
      const responses = await db
        .select()
        .from(chatIntentResponses)
        .where(eq(chatIntentResponses.intentId, intent.id))
        .orderBy(asc(chatIntentResponses.displayOrder));
      return { ...intent, keywords, responses };
    }),
  );

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const parsed = await parseBody(createSchema, request);
  if (!parsed.ok) return parsed.response;

  const { name, description, isActive, keywords, responses } = parsed.data;

  for (const kw of keywords) {
    if (kw.matchType === 'regex') {
      const check = validateRegex(kw.keyword);
      if (!check.valid) {
        return NextResponse.json({ error: `regex ไม่ถูกต้อง: ${check.error}` }, { status: 400 });
      }
    }
  }

  const db = await getDb();
  const id = generateId();

  await db.insert(chatIntents).values({ id, name, description, isActive });

  await db.insert(chatIntentKeywords).values(
    keywords.map((kw) => ({
      id: generateId(),
      intentId: id,
      keyword: kw.keyword,
      matchType: kw.matchType,
    })),
  );

  await db.insert(chatIntentResponses).values(
    responses.map((r) => ({
      id: generateId(),
      intentId: id,
      replyType: r.replyType,
      textContent: r.textContent ?? null,
      replyObjectId: r.replyObjectId ?? null,
      displayOrder: r.displayOrder,
    })),
  );

  invalidateIntentCache();

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.INTENT_CREATE,
    resource: 'chat_intents',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
