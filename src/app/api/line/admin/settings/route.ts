import { NextResponse } from 'next/server';
import { getChatSetting, setChatSetting, invalidateSettingsCache, type ChatSettingsDefaults } from '@/lib/line/settings';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { z } from 'zod';

export const runtime = 'nodejs';

const settingsSchema = z.object({
  welcome_message: z.string().min(1).max(1000).optional(),
  handoff_keywords: z.array(z.string().min(1).max(50)).min(1).max(20).optional(),
  business_hours: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
    days: z.array(z.number().int().min(0).max(6)),
  }).optional(),
  bot_enabled: z.boolean().optional(),
});

export async function GET() {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const [welcome, keywords, hours, enabled] = await Promise.all([
    getChatSetting('welcome_message'),
    getChatSetting('handoff_keywords'),
    getChatSetting('business_hours'),
    getChatSetting('bot_enabled'),
  ]);

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const lineStatus = {
    configured: !!token,
    maskedToken: token ? `****${token.slice(-4)}` : null,
  };

  return NextResponse.json({
    welcome_message: welcome,
    handoff_keywords: keywords,
    business_hours: hours,
    bot_enabled: enabled,
    line: lineStatus,
  });
}

export async function PUT(request: Request) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }

  const entries = Object.entries(parsed.data) as [keyof ChatSettingsDefaults, unknown][];
  for (const [key, value] of entries) {
    if (value !== undefined) {
      await setChatSetting(key, value as never);
    }
  }

  invalidateSettingsCache();

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.CHATBOT_SETTINGS_UPDATE,
    resource: 'chat_settings',
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
    metadata: { keys: Object.keys(parsed.data) },
  });

  return NextResponse.json({ ok: true });
}
