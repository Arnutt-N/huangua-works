import { NextResponse } from 'next/server';
import { getChatSetting, setChatSettings } from '@/lib/line/settings';
import { parseBody } from '@/lib/api-helpers';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { z } from 'zod';

export const runtime = 'nodejs';

// 'HH:MM' 00:00–23:59 หรือ '24:00' (= สิ้นวัน) — ตรงกับ parseClockMinutes ใน business-hours.ts
const CLOCK_PATTERN = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;

const settingsSchema = z.object({
  welcome_message: z.string().min(1).max(1000).optional(),
  handoff_keywords: z.array(z.string().min(1).max(50)).min(1).max(20).optional(),
  business_hours: z
    .object({
      start: z.string().regex(CLOCK_PATTERN, 'เวลาเปิดต้องอยู่ในรูปแบบ HH:MM'),
      end: z.string().regex(CLOCK_PATTERN, 'เวลาปิดต้องอยู่ในรูปแบบ HH:MM'),
      days: z.array(z.number().int().min(0).max(6)).max(7),
    })
    // § 'HH:MM' เติมศูนย์ครบ จึงเทียบแบบ string ได้ถูกต้อง — ไม่รองรับช่วงข้ามเที่ยงคืน
    // (บอทถือว่าค่าแบบนั้นเสียและ fail-open) จึงปฏิเสธตั้งแต่ตอนบันทึก
    .refine((hours) => hours.start < hours.end, { message: 'เวลาเปิดต้องมาก่อนเวลาปิด' })
    .transform((hours) => ({ ...hours, days: [...new Set(hours.days)].sort((a, b) => a - b) }))
    .optional(),
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

  const result = await parseBody(settingsSchema, request);
  if (!result.ok) return result.response;

  // § บันทึกทุก key ใน transaction เดียว และ setChatSettings ประกาศการเปลี่ยนแปลงให้
  // webhook process อื่นเอง — route ไม่ต้องเรียก invalidate อีกแล้ว
  await setChatSettings(result.data);

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.CHATBOT_SETTINGS_UPDATE,
    resource: 'chat_settings',
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
    metadata: { keys: Object.keys(result.data) },
  });

  return NextResponse.json({ ok: true });
}
