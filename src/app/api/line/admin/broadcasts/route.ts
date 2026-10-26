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
import { BROADCAST_TITLE_MAX } from '@/lib/contracts';
import { broadcastContentSchema as contentSchema } from '@/lib/line/broadcast-content-schema';
import { z } from 'zod';

export const runtime = 'nodejs';

const createSchema = z
  .object({
    title: z.string().trim().max(BROADCAST_TITLE_MAX, 'ชื่อแคมเปญยาวเกินไป').nullable().optional(),
    content: z.array(contentSchema).min(1).max(5),
    target: broadcastTargetSchema.default({ kind: 'all' }),
    scheduledAt: z.string().datetime().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    // § field เป็น nullable.optional → .refine บน field ตรง ๆ จะโดน null/undefined ด้วย
    // ใช้ superRefine ระดับ object แล้วเช็คเฉพาะค่าที่มีจริง
    if (data.scheduledAt && new Date(data.scheduledAt).getTime() <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduledAt'],
        message: 'เวลาส่งต้องเป็นอนาคต — เลือกเวลาใหม่หรือเว้นว่างเพื่อสร้างเป็นร่าง',
      });
    }
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
