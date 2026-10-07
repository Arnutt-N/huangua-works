import { NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { deleteIntent, updateIntent } from '@/lib/line/bot/intent-store';
import { parseBody } from '@/lib/api-helpers';
import { z } from 'zod';
import { intentWriteErrorResponse } from '../intent-response';

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

  // § intent-store ทำทั้งก้อนใน transaction — เดิมลบแล้ว insert ใหม่นอก transaction
  const result = await updateIntent(id, parsed.data);
  if (!result.ok) return intentWriteErrorResponse(result);

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
  const result = await deleteIntent(id);
  if (!result.ok) return intentWriteErrorResponse(result);

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
