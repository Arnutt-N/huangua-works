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

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  keywords: z.array(keywordSchema).min(1).max(50).optional(),
  responses: z.array(responseSchema).min(1).max(10).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const parsed = await parseBody(updateSchema, request);
  if (!parsed.ok) return parsed.response;

  const db = await getDb();
  const [existing] = await db.select().from(chatIntents).where(eq(chatIntents.id, id)).limit(1);
  if (!existing) return NextResponse.json({ error: 'ไม่พบ intent' }, { status: 404 });

  const { name, description, isActive, keywords, responses } = parsed.data;

  if (keywords) {
    for (const kw of keywords) {
      if (kw.matchType === 'regex') {
        const check = validateRegex(kw.keyword);
        if (!check.valid) {
          return NextResponse.json({ error: `regex ไม่ถูกต้อง: ${check.error}` }, { status: 400 });
        }
      }
    }
  }

  if (name !== undefined || description !== undefined || isActive !== undefined) {
    await db
      .update(chatIntents)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        updatedAt: new Date(),
      })
      .where(eq(chatIntents.id, id));
  }

  if (keywords) {
    await db.delete(chatIntentKeywords).where(eq(chatIntentKeywords.intentId, id));
    await db.insert(chatIntentKeywords).values(
      keywords.map((kw) => ({
        id: generateId(),
        intentId: id,
        keyword: kw.keyword,
        matchType: kw.matchType,
      })),
    );
  }

  if (responses) {
    await db.delete(chatIntentResponses).where(eq(chatIntentResponses.intentId, id));
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
  }

  invalidateIntentCache();

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.INTENT_UPDATE,
    resource: 'chat_intents',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const db = await getDb();
  const [existing] = await db.select().from(chatIntents).where(eq(chatIntents.id, id)).limit(1);
  if (!existing) return NextResponse.json({ error: 'ไม่พบ intent' }, { status: 404 });

  await db.delete(chatIntents).where(eq(chatIntents.id, id));

  invalidateIntentCache();

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.INTENT_DELETE,
    resource: 'chat_intents',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true });
}
