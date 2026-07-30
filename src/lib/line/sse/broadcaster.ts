import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { redis } from '@/lib/upstash';

const emitter = new EventEmitter();
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

let subscriberStarted = false;

function ensureRedisSubscriber() {
  if (!REDIS_BRIDGE_ENABLED || subscriberStarted) return;
  subscriberStarted = true;

  const sub = redis.subscribe<WireEvent>(CHANNEL);
  sub.on('message', ({ message }) => {
    if (!message || message._origin === SERVER_ID) return;
    const { _origin: _ignored, ...event } = message;
    emitter.emit('sse', event as SseEvent);
  });
  sub.on('error', (error) => {
    console.warn('[sse-broadcaster] redis subscriber error', error);
  });
}

export function subscribe(listener: (event: SseEvent) => void): () => void {
  ensureRedisSubscriber();
  emitter.on('sse', listener);
  return () => emitter.off('sse', listener);
}
