import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatFaq } from '@/lib/db/schema';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { z } from 'zod';

export const runtime = 'nodejs';

const faqUpdateSchema = z.object({
  question: z.string().min(1).max(500).optional(),
  answer: z.string().min(1).max(2000).optional(),
  keywords: z.array(z.string().min(1).max(100)).min(1).max(20).optional(),
  priority: z.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = faqUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.select({ id: chatFaq.id }).from(chatFaq).where(eq(chatFaq.id, id)).limit(1);
  if (!existing[0]) {
    return NextResponse.json({ error: 'ไม่พบ FAQ' }, { status: 404 });
  }

  await db
    .update(chatFaq)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(chatFaq.id, id));

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.FAQ_UPDATE,
    resource: 'chat_faq',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
    metadata: { changes: Object.keys(parsed.data) },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const db = await getDb();

  const existing = await db.select({ id: chatFaq.id }).from(chatFaq).where(eq(chatFaq.id, id)).limit(1);
  if (!existing[0]) {
    return NextResponse.json({ error: 'ไม่พบ FAQ' }, { status: 404 });
  }

  await db.update(chatFaq).set({ isActive: false, updatedAt: new Date() }).where(eq(chatFaq.id, id));

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.FAQ_DELETE,
    resource: 'chat_faq',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true });
}
