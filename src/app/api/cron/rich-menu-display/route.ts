/**
 * GET /api/cron/rich-menu-display — แสดง/ปลดเมนูตามเวลาที่ตั้งไว้ (เรียกทุก ~1 ชม.)
 * activate = ตั้งเป็น default + status active; expire = status inactive +
 * ยกเลิก default เฉพาะเมื่อเมนูหมดอายุยังเป็นเจ้าของ (ไม่ทับของที่คนตั้งมือ)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCron } from '@/lib/cron-auth';
import { runDisplayTick } from '@/lib/line/rich-menu-service';

export async function GET(req: NextRequest) {
  const auth = requireCron(req);
  if (!auth.ok) return auth.response;

  const result = await runDisplayTick();
  if (result.error) {
    console.error('[cron/rich-menu-display]', result.error);
    return NextResponse.json(
      { ok: false, error: result.error, activated: result.activated, expired: result.expired, failed: result.failed },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, activated: result.activated, expired: result.expired, failed: result.failed });
}
