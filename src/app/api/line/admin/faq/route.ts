import { NextResponse } from 'next/server';
import { asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatFaq } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { z } from 'zod';

export const runtime = 'nodejs';

const faqCreateSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(2000),
  keywords: z.array(z.string().min(1).max(100)).min(1).max(20),
  priority: z.number().int().min(0).max(100).default(0),
  isActive: z.boolean().default(true),
});

export async function GET(request: Request) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const activeOnly = searchParams.get('active') === 'true';
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100);
  const offset = Number(searchParams.get('offset') ?? 0);

  const db = await getDb();
  const conditions = [];
  if (activeOnly) conditions.push(eq(chatFaq.isActive, true));
  if (q) conditions.push(or(ilike(chatFaq.question, `%${q}%`), ilike(chatFaq.answer, `%${q}%`)));

  const rows = await db
    .select()
    .from(chatFaq)
    .where(conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined)
    .orderBy(desc(chatFaq.priority), asc(chatFaq.question))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chatFaq)
    .where(conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined);

  return NextResponse.json({ items: rows, total: countResult[0]?.count ?? 0 });
}

export async function POST(request: Request) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = faqCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }

  const db = await getDb();
  const id = generateId();

  await db.insert(chatFaq).values({
    id,
    question: parsed.data.question,
    answer: parsed.data.answer,
    keywords: parsed.data.keywords,
    priority: parsed.data.priority,
    isActive: parsed.data.isActive,
  });

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.FAQ_CREATE,
    resource: 'chat_faq',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
