import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatMessages, chatConversations, users } from '@/lib/db/schema';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { STAFF_ROLES } from '@/lib/auth/roles';
import {
  chatPagingQuerySchema,
  updateConversationSchema,
  validateOrError,
} from '@/lib/validation';
import { broadcast } from '@/lib/line/sse/broadcaster';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const url = new URL(request.url);
  const validation = validateOrError(chatPagingQuerySchema, {
    before: url.searchParams.get('before') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { before, limit } = validation.data;

  const db = await getDb();

  const [conversation] = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.id, id))
    .limit(1);

  if (!conversation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // cursor = message id (UUIDv7 เรียงตามเวลา) — ดึงใหม่สุด limit+1 แล้ว reverse
  // ให้ client ได้ messages เรียง asc เหมือนเดิม + รู้ว่ามีหน้าก่อนหน้าอีกไหม
  const page = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.conversationId, id),
        before ? lt(chatMessages.id, before) : undefined,
      ),
    )
    .orderBy(desc(chatMessages.id))
    .limit(limit + 1);

  const hasMore = page.length > limit;
  const messages = page.slice(0, limit).reverse();

  return NextResponse.json({ conversation, messages, hasMore });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validation = validateOrError(updateConversationSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { mode, linkedCaseId, assignedAdminId, transferReason, adminNote } = validation.data;
  const { id } = await params;
  const db = await getDb();

  // ── โอนแชท / รับช่วงต่อ — path แยกจาก claim (mode ต้องเป็น human_active อยู่แล้ว) ──
  if (assignedAdminId !== undefined && mode === undefined) {
    // กันโอนให้ id ผี — ปลายทางต้องเป็นเจ้าหน้าที่ที่ยัง active จริง
    const [target] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, assignedAdminId),
          eq(users.isActive, true),
          inArray(users.role, [...STAFF_ROLES]),
        ),
      )
      .limit(1);
    if (!target) {
      return NextResponse.json(
        { error: 'ปลายทางไม่ใช่เจ้าหน้าที่ที่ใช้งานอยู่' },
        { status: 400 },
      );
    }

    const transferAudit = {
      toAdminId: assignedAdminId,
      byAdminId: authz.ctx.user.id,
      at: new Date().toISOString(),
      ...(transferReason ? { reason: transferReason } : {}),
    };

    const [transferred] = await db
      .update(chatConversations)
      .set({
        assignedAdminId,
        assignedAt: new Date(),
        updatedAt: new Date(),
        metadata: sql`jsonb_set(
          coalesce(${chatConversations.metadata}, '{}'::jsonb),
          '{transfers}',
          coalesce(${chatConversations.metadata} -> 'transfers', '[]'::jsonb) || ${JSON.stringify(transferAudit)}::jsonb
        )`,
      })
      // atomic guard: โอนได้เฉพาะห้องที่เจ้าหน้าที่กำลังดูแลอยู่จริง
      .where(and(eq(chatConversations.id, id), eq(chatConversations.mode, 'human_active')))
      .returning({ id: chatConversations.id });

    if (!transferred) {
      const [existing] = await db
        .select({ id: chatConversations.id })
        .from(chatConversations)
        .where(eq(chatConversations.id, id))
        .limit(1);
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(
        { error: 'โอนแชทได้เฉพาะห้องที่เจ้าหน้าที่กำลังดูแลอยู่' },
        { status: 409 },
      );
    }

    broadcast({
      type: 'mode_change',
      conversationId: id,
      payload: { mode: 'human_active', assignedAdminId },
    });
    return NextResponse.json({ ok: true });
  }

  // ── โน้ตภายใน — autosave, ไม่ broadcast (กัน refetch ไป clobber draft ของแอดมินอื่น) ──
  if (adminNote !== undefined && mode === undefined && linkedCaseId === undefined) {
    const [noted] = await db
      .update(chatConversations)
      .set({
        adminNote,
        adminNoteUpdatedAt: new Date(),
        adminNoteUpdatedBy: authz.ctx.user.id,
        updatedAt: new Date(),
      })
      .where(eq(chatConversations.id, id))
      .returning({ id: chatConversations.id });

    if (!noted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const updates: Partial<typeof chatConversations.$inferInsert> = { updatedAt: new Date() };

  if (mode) {
    updates.mode = mode;
    if (mode === 'human_active') {
      updates.assignedAdminId = authz.ctx.user.id;
      updates.assignedAt = new Date();
    }
    if (mode === 'resolved') {
      updates.resolvedAt = new Date();
    }
  }

  if (linkedCaseId !== undefined) {
    updates.linkedCaseId = linkedCaseId;
  }

  // claim ต้องเป็น atomic — guard mode ใน WHERE กันสองแอดมินกดรับพร้อมกันแล้วคนหลังทับเงียบๆ
  const claimGuard =
    mode === 'human_active'
      ? inArray(chatConversations.mode, ['bot_active', 'waiting_handoff'])
      : undefined;

  const [updated] = await db
    .update(chatConversations)
    .set(updates)
    .where(and(eq(chatConversations.id, id), claimGuard))
    .returning({ id: chatConversations.id });

  if (!updated) {
    const [existing] = await db
      .select({
        mode: chatConversations.mode,
        assignedAdminId: chatConversations.assignedAdminId,
      })
      .from(chatConversations)
      .where(eq(chatConversations.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (existing.mode === 'human_active' && existing.assignedAdminId === authz.ctx.user.id) {
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: 'มีเจ้าหน้าที่รับเรื่องนี้แล้ว' },
      { status: 409 },
    );
  }

  broadcast({ type: 'mode_change', conversationId: id, payload: updates });

  return NextResponse.json({ ok: true });
}
