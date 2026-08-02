import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';

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

export async function GET() {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const [db, redis, line, sse] = await Promise.all([probeDb(), probeRedis(), probeLine(), probeSseBroadcaster()]);

  const allOk = [db, redis, line, sse].every((p) => p.status === 'ok');

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    probes: [db, redis, line, sse],
    timestamp: new Date().toISOString(),
  });
}
