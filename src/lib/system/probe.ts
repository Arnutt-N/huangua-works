import { connect } from 'node:net';
import { isStorageConfigured } from '../storage';

/**
 * Probe ปลายทางเชื่อมต่อภายนอกแบบเบา (timeout 5 วินาทีทุกเจ้า)
 * คืนแค่ connected degraded หรือ unknown — ไม่พ่น error ให้ caller
 * unknown แปลว่าตั้งค่าไม่ครบจน probe ไม่ได้ ไม่ใช่ล่ม
 */

export const CONNECTION_PROVIDERS = ['line', 's3', 'smtp'] as const;

export type ConnectionProvider = (typeof CONNECTION_PROVIDERS)[number];

export type ConnectionProbeStatus = 'connected' | 'degraded' | 'down' | 'unknown';

const PROBE_TIMEOUT_MS = 5_000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function probeLine(): Promise<{ status: ConnectionProbeStatus; endpoint: string }> {
  const endpoint = 'https://api.line.me';
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { status: 'unknown', endpoint };
  try {
    const res = await fetchWithTimeout(`${endpoint}/v2/bot/info`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { status: res.ok ? 'connected' : 'degraded', endpoint };
  } catch {
    return { status: 'degraded', endpoint };
  }
}

async function probeS3(): Promise<{ status: ConnectionProbeStatus; endpoint: string }> {
  const endpoint = process.env.S3_ENDPOINT ?? '';
  if (!endpoint || !isStorageConfigured()) return { status: 'unknown', endpoint };
  try {
    // § HEAD แบบไม่เซ็นชื่อพอแยกได้ว่า host ตอบ (S3 ตอบ 403/200) หรือหายไปเลย
    await fetchWithTimeout(endpoint, { method: 'HEAD' });
    return { status: 'connected', endpoint };
  } catch {
    return { status: 'degraded', endpoint };
  }
}

async function probeSmtp(): Promise<{ status: ConnectionProbeStatus; endpoint: string }> {
  const host = process.env.SMTP_HOST ?? '';
  const port = Number(process.env.SMTP_PORT ?? 587);
  const endpoint = host ? `smtp://${host}:${port}` : '';
  if (!host) return { status: 'unknown', endpoint };
  const reachable = await new Promise<boolean>((resolve) => {
    const socket = connect(port, host);
    const done = (value: boolean) => {
      socket.destroy();
      resolve(value);
    };
    const timer = setTimeout(() => done(false), PROBE_TIMEOUT_MS);
    socket.once('connect', () => {
      clearTimeout(timer);
      done(true);
    });
    socket.once('error', () => {
      clearTimeout(timer);
      done(false);
    });
  });
  return { status: reachable ? 'connected' : 'degraded', endpoint };
}

export async function probeProvider(
  provider: ConnectionProvider,
): Promise<{ status: ConnectionProbeStatus; endpoint: string }> {
  if (provider === 'line') return probeLine();
  if (provider === 's3') return probeS3();
  return probeSmtp();
}
