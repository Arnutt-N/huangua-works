import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { getLiffId } from '@/lib/liff/config';
import { probeProvider } from '@/lib/system/probe';

export const runtime = 'nodejs';

interface ProbeResult {
  name: string;
  status: 'ok' | 'error';
  latencyMs: number;
  detail?: string;
  /** § probe สถานะการตั้งค่า ไม่ใช่สุขภาพบริการ — ไม่นับใน allOk */
  optional: boolean;
}

async function probeDb(): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const db = await getDb();
    await db.execute(sql`SELECT 1`);
    return { name: 'PostgreSQL', status: 'ok', latencyMs: Date.now() - start, optional: false };
  } catch (err) {
    return { name: 'PostgreSQL', status: 'error', latencyMs: Date.now() - start, detail: String(err).slice(0, 200), optional: false };
  }
}

async function probeRedis(): Promise<ProbeResult> {
  const start = Date.now();
  const url = process.env.UPSTASH_REDIS_REST_URL;
  if (!url) return { name: 'Upstash Redis', status: 'error', latencyMs: 0, detail: 'UPSTASH_REDIS_REST_URL not set', optional: false };
  try {
    const res = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });
    return { name: 'Upstash Redis', status: res.ok ? 'ok' : 'error', latencyMs: Date.now() - start, optional: false };
  } catch (err) {
    return { name: 'Upstash Redis', status: 'error', latencyMs: Date.now() - start, detail: String(err).slice(0, 200), optional: false };
  }
}

async function probeLine(): Promise<ProbeResult> {
  const start = Date.now();
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { name: 'LINE API', status: 'error', latencyMs: 0, detail: 'LINE_CHANNEL_ACCESS_TOKEN not set', optional: false };
  try {
    const res = await fetch('https://api.line.me/v2/bot/info', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    return { name: 'LINE API', status: res.ok ? 'ok' : 'error', latencyMs: Date.now() - start, optional: false };
  } catch (err) {
    return { name: 'LINE API', status: 'error', latencyMs: Date.now() - start, detail: String(err).slice(0, 200), optional: false };
  }
}

async function probeSseBroadcaster(): Promise<ProbeResult> {
  const start = Date.now();
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return { name: 'SSE Broadcaster', status: 'ok', latencyMs: 0, detail: 'in-process mode (no Redis bridge)', optional: false };
  }
  try {
    const res = await fetch(`${url}/exists/sse:line-chat`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    return { name: 'SSE Broadcaster', status: res.ok ? 'ok' : 'error', latencyMs: Date.now() - start, optional: false };
  } catch (err) {
    return { name: 'SSE Broadcaster', status: 'error', latencyMs: Date.now() - start, detail: String(err).slice(0, 200), optional: false };
  }
}

async function probeS3(): Promise<ProbeResult> {
  const start = Date.now();
  const { status, endpoint } = await probeProvider('s3');
  if (status === 'unknown') {
    return {
      name: 'S3 Storage',
      status: 'error',
      latencyMs: 0,
      detail: 'ยังไม่ตั้งค่า S3 — อัปโหลดไฟล์ปิดอยู่ (ตั้งครบ S3_ENDPOINT + S3_ACCESS_KEY_ID + S3_SECRET_ACCESS_KEY)',
      optional: true,
    };
  }
  return {
    name: 'S3 Storage',
    status: status === 'connected' ? 'ok' : 'error',
    latencyMs: Date.now() - start,
    detail: status === 'connected' ? endpoint : `เชื่อมต่อ ${endpoint} ไม่ได้`,
    optional: true,
  };
}

async function probeLiff(): Promise<ProbeResult> {
  const id = getLiffId();
  // § ตาม risk row ของ docs/prp-liff-mobile.md — "ลืมตั้ง/ลืม redeploy NEXT_PUBLIC_LIFF_ID"
  // ต้องเห็นเป็นสัญญาณเตือนจริง จึงรายงาน error (ไอคอนแดงบน /admin/health)
  // แต่ LIFF เป็นช่องทาง optional ตาม design (src/lib/liff/config.ts) จึงตั้ง optional: true
  // — GET คิด allOk จาก probe ที่ไม่ optional เท่านั้น badge รวมจึงไม่ degraded
  // จากการตั้งค่าที่ปิดโดยตั้งใจ (optional by design, not a service health signal)
  if (!id) {
    return {
      name: 'LIFF Config',
      status: 'error',
      latencyMs: 0,
      detail: 'ยังไม่ตั้ง NEXT_PUBLIC_LIFF_ID — ปิดช่องทาง LIFF (ทำงานแบบเว็บธรรมดา)',
      optional: true,
    };
  }
  return { name: 'LIFF Config', status: 'ok', latencyMs: 0, detail: id, optional: true };
}

export async function GET() {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const probes = await Promise.all([
    probeDb(),
    probeRedis(),
    probeLine(),
    probeS3(),
    probeSseBroadcaster(),
    probeLiff(),
  ]);

  // § probe ที่ optional เป็นสถานะการตั้งค่า ไม่ใช่สุขภาพบริการ (ดู § ใน probeLiff/probeS3)
  const allOk = probes.filter((p) => !p.optional).every((p) => p.status === 'ok');

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    probes,
    timestamp: new Date().toISOString(),
  });
}
