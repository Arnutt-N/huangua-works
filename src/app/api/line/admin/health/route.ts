import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { getLiffId } from '@/lib/liff/config';

export const runtime = 'nodejs';

interface ProbeResult {
  name: string;
  status: 'ok' | 'error';
  latencyMs: number;
  detail?: string;
}

async function probeDb(): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const db = await getDb();
    await db.execute(sql`SELECT 1`);
    return { name: 'PostgreSQL', status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    return { name: 'PostgreSQL', status: 'error', latencyMs: Date.now() - start, detail: String(err).slice(0, 200) };
  }
}

async function probeRedis(): Promise<ProbeResult> {
  const start = Date.now();
  const url = process.env.UPSTASH_REDIS_REST_URL;
  if (!url) return { name: 'Upstash Redis', status: 'error', latencyMs: 0, detail: 'UPSTASH_REDIS_REST_URL not set' };
  try {
    const res = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });
    return { name: 'Upstash Redis', status: res.ok ? 'ok' : 'error', latencyMs: Date.now() - start };
  } catch (err) {
    return { name: 'Upstash Redis', status: 'error', latencyMs: Date.now() - start, detail: String(err).slice(0, 200) };
  }
}

async function probeLine(): Promise<ProbeResult> {
  const start = Date.now();
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { name: 'LINE API', status: 'error', latencyMs: 0, detail: 'LINE_CHANNEL_ACCESS_TOKEN not set' };
  try {
    const res = await fetch('https://api.line.me/v2/bot/info', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    return { name: 'LINE API', status: res.ok ? 'ok' : 'error', latencyMs: Date.now() - start };
  } catch (err) {
    return { name: 'LINE API', status: 'error', latencyMs: Date.now() - start, detail: String(err).slice(0, 200) };
  }
}

async function probeSseBroadcaster(): Promise<ProbeResult> {
  const start = Date.now();
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return { name: 'SSE Broadcaster', status: 'ok', latencyMs: 0, detail: 'in-process mode (no Redis bridge)' };
  }
  try {
    const res = await fetch(`${url}/exists/sse:line-chat`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    return { name: 'SSE Broadcaster', status: res.ok ? 'ok' : 'error', latencyMs: Date.now() - start };
  } catch (err) {
    return { name: 'SSE Broadcaster', status: 'error', latencyMs: Date.now() - start, detail: String(err).slice(0, 200) };
  }
}

async function probeLiff(): Promise<ProbeResult> {
  const id = getLiffId();
  // § ตาม risk row ของ docs/prp-liff-mobile.md — "ลืมตั้ง/ลืม redeploy NEXT_PUBLIC_LIFF_ID"
  // ต้องเห็นเป็นสัญญาณเตือนจริง จึงรายงาน error (ไอคอนแดงบน /admin/health)
  // แต่ LIFF เป็นช่องทาง optional ตาม design (src/lib/liff/config.ts) จึงถูก exclude
  // จาก allOk ใน GET — badge รวมไม่ degraded จากการตั้งค่าที่ปิดโดยตั้งใจ
  if (!id) {
    return {
      name: 'LIFF Config',
      status: 'error',
      latencyMs: 0,
      detail: 'ยังไม่ตั้ง NEXT_PUBLIC_LIFF_ID — ปิดช่องทาง LIFF (ทำงานแบบเว็บธรรมดา)',
    };
  }
  return { name: 'LIFF Config', status: 'ok', latencyMs: 0, detail: id };
}

export async function GET() {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const [db, redis, line, sse, liff] = await Promise.all([
    probeDb(),
    probeRedis(),
    probeLine(),
    probeSseBroadcaster(),
    probeLiff(),
  ]);

  // § liff ไม่อยู่ใน allOk — เป็น probe สถานะการตั้งค่า ไม่ใช่สุขภาพบริการ (ดู § ใน probeLiff)
  const allOk = [db, redis, line, sse].every((p) => p.status === 'ok');

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    probes: [db, redis, line, sse, liff],
    timestamp: new Date().toISOString(),
  });
}
