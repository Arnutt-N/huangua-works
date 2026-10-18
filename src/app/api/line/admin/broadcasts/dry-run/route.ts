import { NextResponse } from 'next/server';
import { parseBody } from '@/lib/api-helpers';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { broadcastTargetSchema } from '@/lib/line/broadcast-target';
import { dryRunBroadcast } from '@/lib/line/broadcast-service';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({ target: broadcastTargetSchema });

export async function POST(request: Request) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const result = await parseBody(schema, request);
  if (!result.ok) return result.response;

  const dry = await dryRunBroadcast(result.data.target);
  return NextResponse.json({ estimatedRecipients: dry.estimatedRecipients });
}
