import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSystemSetting, setSystemSettings } from '@/lib/system/settings';
import { parseBody } from '@/lib/api-helpers';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';

export const runtime = 'nodejs';

// § schema อยู่ไฟล์ route แบบเดียวกับ line/admin/settings (ไม่โยนเข้า validation.ts)
// เพราะ shape นี้ผูกกับ allowlist ของ system module เท่านั้น
const systemSettingsSchema = z
  .object({
    maintenance_mode: z.boolean().optional(),
    audit_retention_days: z.number().int().min(30).max(3650).optional(),
    import_default_org: z.literal('huangua').optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, { message: 'ต้องระบุค่าอย่างน้อย 1 key' });

export async function GET() {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const [maintenance, retention, org] = await Promise.all([
    getSystemSetting('maintenance_mode'),
    getSystemSetting('audit_retention_days'),
    getSystemSetting('import_default_org'),
  ]);

  return NextResponse.json({
    maintenance_mode: maintenance,
    audit_retention_days: retention,
    import_default_org: org,
  });
}

export async function PUT(request: Request) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const result = await parseBody(systemSettingsSchema, request);
  if (!result.ok) return result.response;

  await setSystemSettings(result.data);

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.SYSTEM_SETTING_UPDATE,
    resource: 'system_settings',
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
    metadata: { keys: Object.keys(result.data) },
  });

  return NextResponse.json({ ok: true });
}
