import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { apiConnections } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { parseBody } from '@/lib/api-helpers';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { CONNECTION_PROVIDERS, probeProvider, type ConnectionProvider } from '@/lib/system/probe';

export const runtime = 'nodejs';

const refreshSchema = z.object({
  provider: z.enum(CONNECTION_PROVIDERS),
});

function toJson(row: typeof apiConnections.$inferSelect) {
  return {
    provider: row.provider,
    endpoint: row.endpoint,
    status: row.status,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
  };
}

export async function GET() {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const db = await getDb();
  const rows = await db.select().from(apiConnections);
  return NextResponse.json({ items: rows.map(toJson) });
}

export async function POST(request: Request) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const result = await parseBody(refreshSchema, request);
  if (!result.ok) return result.response;

  const provider = result.data.provider as ConnectionProvider;
  const probe = await probeProvider(provider);

  const db = await getDb();
  const now = new Date();
  const [row] = await db
    .insert(apiConnections)
    .values({
      id: generateId(),
      provider,
      endpoint: probe.endpoint,
      status: probe.status,
      lastCheckedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: apiConnections.provider,
      set: { endpoint: probe.endpoint, status: probe.status, lastCheckedAt: now, updatedAt: now },
    })
    .returning();
  if (!row) return NextResponse.json({ error: 'บันทึกสถานะไม่สำเร็จ' }, { status: 500 });

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.API_CONNECTION_UPDATE,
    resource: 'api_connections',
    resourceId: row.id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
    metadata: { provider, status: probe.status },
  });

  return NextResponse.json({ ok: true, item: toJson(row) });
}
