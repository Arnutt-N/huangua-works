import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatReplyObjects } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { parseBody } from '@/lib/api-helpers';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { z } from 'zod';
import { replyObjectTypeSchema, validateReplyPayload } from '@/lib/line/reply-object-validation';

export const runtime = 'nodejs';

const createSchema = z.object({
  objectId: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/, 'ใช้ a-z, 0-9, -, _ เท่านั้น'),
  objectType: replyObjectTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  altText: z.string().max(200).optional(),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const db = await getDb();
  const rows = await db
    .select()
    .from(chatReplyObjects)
    .orderBy(asc(chatReplyObjects.objectId));

  return NextResponse.json({ items: rows });
}

export async function POST(request: Request) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const result = await parseBody(createSchema, request);
  if (!result.ok) return result.response;

  // § payload ตรวจที่ boundary ฝั่ง server ด้วย (client ข้ามได้ด้วย curl) — กฎเดียวกับฟอร์ม
  const payloadError = validateReplyPayload(result.data.objectType, result.data.payload);
  if (payloadError) return NextResponse.json({ error: payloadError }, { status: 400 });

  const db = await getDb();
  const id = generateId();

  try {
    await db.insert(chatReplyObjects).values({
      id,
      objectId: result.data.objectId,
      objectType: result.data.objectType,
      payload: result.data.payload,
      altText: result.data.altText ?? null,
      isActive: result.data.isActive,
      createdBy: authz.ctx.user.id,
    });
  } catch (error) {
    // § 409 เฉพาะชน unique จริง — error อื่น (เช่น enum/DB) ต้อง 500 ดังๆ ไม่ใช่บอก id ซ้ำผิดๆ
    if (typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505') {
      return NextResponse.json({ error: 'object_id นี้ถูกใช้แล้ว' }, { status: 409 });
    }
    throw error;
  }

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.REPLY_OBJECT_CREATE,
    resource: 'chat_reply_objects',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
