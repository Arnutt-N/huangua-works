import { NextResponse } from 'next/server';
import { count, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatBroadcasts, chatBroadcastFailedRecipients } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { parseBody } from '@/lib/api-helpers';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { broadcastTargetSchema } from '@/lib/line/broadcast-target';
import { BROADCAST_TEXT_MAX, BROADCAST_TITLE_MAX } from '@/lib/contracts';
import { z } from 'zod';

export const runtime = 'nodejs';

const httpsUrl = z.string().url().refine((u) => u.startsWith('https://'), 'ต้องเป็น https URL');

// § content เป็น discriminated union เข้มเท่า LINE รับ — เดิมตรวจแค่ type string + passthrough
// bypass wizard POST ตรงเก็บของผิดลง DB ไปแตกตอน send/cron (502 ทีหลัง) ต้อง fail ที่ boundary
const contentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().min(1).max(BROADCAST_TEXT_MAX) }).passthrough(),
  z.object({ type: z.literal('image'), originalContentUrl: httpsUrl, previewImageUrl: httpsUrl }).passthrough(),
  z.object({ type: z.literal('flex'), altText: z.string().min(1).max(400), contents: z.record(z.string(), z.unknown()) }).passthrough(),
]);

const createSchema = z.object({
  title: z.string().trim().max(BROADCAST_TITLE_MAX, 'ชื่อแคมเปญยาวเกินไป').optional(),
  content: z.array(contentSchema).min(1).max(5),
  target: broadcastTargetSchema.default({ kind: 'all' }),
  scheduledAt: z.string().datetime().nullable().optional(),
});

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
  status: z
    .enum(['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'])
    .optional(),
});

export async function GET(request: Request) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'พารามิเตอร์ไม่ถูกต้อง' },
      { status: 400 },
    );
  }
  const { page, pageSize, status } = parsed.data;

  const db = await getDb();

  const where = status ? eq(chatBroadcasts.status, status) : undefined;
  const [countRow] = await db.select({ value: count() }).from(chatBroadcasts).where(where);
  const total = countRow?.value ?? 0;

  const rows = await db
    .select()
    .from(chatBroadcasts)
    .where(where)
    .orderBy(desc(chatBroadcasts.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const failedById = new Map<string, number>();
  if (rows.length > 0) {
    const failedRows = await db
      .select({ broadcastId: chatBroadcastFailedRecipients.broadcastId, failedRecipients: sql<number>`count(*)::int` })
      .from(chatBroadcastFailedRecipients)
      .where(
        inArray(chatBroadcastFailedRecipients.broadcastId, rows.map((r) => r.id)),
      )
      .groupBy(chatBroadcastFailedRecipients.broadcastId);
    for (const r of failedRows) failedById.set(r.broadcastId, r.failedRecipients);
  }

  return NextResponse.json({
    items: rows.map((row) => ({ ...row, failedRecipients: failedById.get(row.id) ?? 0 })),
    total,
    page,
    pageSize,
  });
}

export async function POST(request: Request) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const result = await parseBody(createSchema, request);
  if (!result.ok) return result.response;

  const db = await getDb();
  const id = generateId();
  const status = result.data.scheduledAt ? 'scheduled' : 'draft';

  await db.insert(chatBroadcasts).values({
    id,
    title: result.data.title ?? null,
    content: result.data.content,
    status,
    target: result.data.target,
    scheduledAt: result.data.scheduledAt ? new Date(result.data.scheduledAt) : null,
    createdBy: authz.ctx.user.id,
  });

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.BROADCAST_CREATE,
    resource: 'chat_broadcasts',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
