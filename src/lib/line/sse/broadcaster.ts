import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { redis } from '@/lib/upstash';

const emitter = new EventEmitter();
// § เพดาน 100 = staff ~20 คน × หลายแท็บ (1 listener ต่อ SSE connection) ยังเหลือ headroom
// default 10 ต่ำกว่าโหลดปกติ → warn หลอก; เกิน 100 ค่อยเป็นสัญญาณรั่วจริง
emitter.setMaxListeners(100);

export interface SseEvent {
  type: 'new_message' | 'conversation_update' | 'mode_change';
  conversationId: string;
  payload: unknown;
}

// บน Vercel webhook lambda กับ SSE lambda เป็นคนละ process — EventEmitter ไม่พอ
// จึง bridge ผ่าน Redis Pub/Sub (Upstash REST subscribe เป็น long-poll/SSE ในตัว)
// ไม่มี Upstash env (dev/test) → ทำงานแบบ in-process เดิม
const REDIS_BRIDGE_ENABLED = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);
const CHANNEL = 'sse:line-chat';
// loopback guard — Redis ส่ง publish กลับหา publisher เอง ถ้าไม่กรองจะ deliver ซ้ำ
const SERVER_ID = randomUUID();

type WireEvent = SseEvent & { _origin: string };

export function broadcast(event: SseEvent) {
  emitter.emit('sse', event);

  if (REDIS_BRIDGE_ENABLED) {
    const wire: WireEvent = { ...event, _origin: SERVER_ID };
    redis.publish(CHANNEL, JSON.stringify(wire)).catch((error) => {
      console.warn('[sse-broadcaster] redis publish failed — local-only delivery', error);
    });
  }
}

type PingWire = { type: 'ping'; _origin: string };
type WireMessage = WireEvent | PingWire;

// § Upstash อ่าน stream ใน IIFE แยก — stream ขาดไม่ยิง 'error' ให้ Subscriber จึงต้องตรวจเอง:
// ping วนกลับหาตัวเอง (loopback) ทุก HEARTBEAT_MS เงียบเกิน STALE_AFTER_MS = stream ตาย → ต่อใหม่
// ข้อความ origin ตัวเอง (ping หรือ broadcast จริง) นับเป็นหลักฐานว่ายังมีชีวิต
const HEARTBEAT_MS = 30_000;
const STALE_AFTER_MS = HEARTBEAT_MS * 2 + 5_000;

type Sub = ReturnType<typeof redis.subscribe<WireMessage>>;
let sub: Sub | null = null;
let lastLoopbackAt = 0;
let watchdog: ReturnType<typeof setInterval> | null = null;

function stopSubscriber(): void {
  const old = sub;
  sub = null;
  if (!old) return;
  old.removeAllListeners();
  old.unsubscribe().catch(() => {});
}

function startSubscriber(): void {
  stopSubscriber();
  const current = redis.subscribe<WireMessage>(CHANNEL);
  sub = current;
  lastLoopbackAt = Date.now();
  current.on('message', ({ message }) => {
    // § ตัวเก่าที่ถูกแทนแล้วห้าม deliver — กันข้อความซ้ำช่วงสลับ subscriber
    if (sub !== current || !message) return;
    if (message._origin === SERVER_ID) {
      lastLoopbackAt = Date.now();
      return;
    }
    if (message.type === 'ping') return;
    const { _origin: _ignored, ...event } = message;
    emitter.emit('sse', event as SseEvent);
  });
  current.on('error', (error) => {
    if (sub !== current) return;
    // § Upstash ยิง 'error' ทั้งตอนต่อไม่ติดและตอน parse ข้อความเดียวพัง — ทั้งสองกรณีต่อใหม่
    // (กรณีหลังเสียข้อความได้ ≤ 1 heartbeat แลกกับไม่ต้องแยกชนิด error ที่ Upstash ไม่ได้ type ไว้)
    console.warn('[sse-broadcaster] redis subscriber error — ต่อใหม่รอบ heartbeat ถัดไป', error);
    stopSubscriber();
  });
}

function stopWatchdog(): void {
  if (watchdog) clearInterval(watchdog);
  watchdog = null;
}

function heartbeat(): void {
  if (emitter.listenerCount('sse') === 0) {
    stopSubscriber();
    stopWatchdog();
    return;
  }
  if (!sub || Date.now() - lastLoopbackAt > STALE_AFTER_MS) startSubscriber();
  const ping: PingWire = { type: 'ping', _origin: SERVER_ID };
  redis.publish(CHANNEL, JSON.stringify(ping)).catch(() => {});
}

function ensureRedisSubscriber(): void {
  if (!REDIS_BRIDGE_ENABLED) return;
  if (!sub) startSubscriber();
  if (!watchdog) {
    watchdog = setInterval(heartbeat, HEARTBEAT_MS);
    watchdog.unref?.();
  }
}

export function subscribe(listener: (event: SseEvent) => void): () => void {
  ensureRedisSubscriber();
  emitter.on('sse', listener);
  return () => emitter.off('sse', listener);
}
