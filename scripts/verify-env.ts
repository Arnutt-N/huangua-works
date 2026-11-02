#!/usr/bin/env tsx
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

// โหลด .env.local ก่อน (ถ้ามี) แล้วค่อย fallback เป็น .env สำหรับการรันแบบ manual CLI
// override: false เพื่อไม่ทับค่าตัวแปรของ Environment/Vercel
config({ path: '.env.local', override: false });
config({ path: '.env', override: false });

/**
 * verify-env.ts - validate required env vars ทุกตัว ตอน build/boot (C2, C3)
 * ขาดหรือไม่ถูกต้อง = fail fast (exit 1) บล็อก deploy ไม่ปล่อยให้ต่อ
 *
 * วิ่งใน build script: `next build && tsx scripts/verify-env.ts`
 * หรือ manual: `npx tsx scripts/verify-env.ts`
 */

export interface EnvSpec {
  key: string;
  label: string;
  minLen?: number;
  serverOnly?: boolean;
}

export const requiredEnvSpecs: readonly EnvSpec[] = [
  {
    key: 'AUTH_SECRET',
    label: 'Auth.js JWT signing secret (SERVER-ONLY - ห้าม NEXT_PUBLIC_)',
    serverOnly: true,
    minLen: 32,
  },
  { key: 'AUTH_URL', label: 'Auth.js trusted app URL (e.g. http://localhost:3000)' },
  { key: 'UPSTASH_REDIS_REST_URL', label: 'Upstash Redis REST URL' },
  { key: 'UPSTASH_REDIS_REST_TOKEN', label: 'Upstash Redis REST token', minLen: 16 },
  { key: 'CID_HMAC_KEY', label: 'CID keyed-HMAC key (C2 - >=32 char)', minLen: 32 },
  {
    key: 'LINE_ID_HMAC_KEY',
    label: 'LINE id pseudonym key (T5 - >=32 char, ห้ามใช้ร่วมกับ CID_HMAC_KEY)',
    minLen: 32,
  },
  { key: 'CRON_SECRET', label: 'Cron shared secret (Authorization: Bearer - >=16 char)', minLen: 16 },
];

export const optionalGroups: readonly { name: string; keys: readonly string[] }[] = [
  { name: 'LIFF', keys: ['NEXT_PUBLIC_LIFF_ID', 'LINE_LOGIN_CHANNEL_ID'] },
  { name: 'S3', keys: ['S3_ACCESS_KEY_ID', 'S3_ENDPOINT', 'S3_SECRET_ACCESS_KEY'] },
];

export function isPlaceholder(val: string): boolean {
  const upper = val.toUpperCase();
  return (
    val.startsWith('YOUR_') ||
    val.startsWith('CHANGE_ME') ||
    upper.includes('[YOUR-PASSWORD]') ||
    upper.includes('[YOUR_PASSWORD]') ||
    upper.includes('<PASSWORD>')
  );
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function validateEnv(
  env: Record<string, string | undefined>,
  isProd = false,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const spec of requiredEnvSpecs) {
    const v = env[spec.key];
    if (!v || isPlaceholder(v)) {
      errors.push(`[FAIL] ${spec.key} - ${spec.label} (ยังเป็น placeholder หรือไม่ได้กำหนดค่า)`);
      continue;
    }
    if (spec.serverOnly && spec.key.startsWith('NEXT_PUBLIC_')) {
      errors.push(
        `[FAIL] ${spec.key} - SERVER-ONLY secret ห้ามมีคำนำหน้า NEXT_PUBLIC_ (จะรั่วสู่ client bundle)`,
      );
    }
    if (spec.minLen && v.length < spec.minLen) {
      errors.push(
        `[FAIL] ${spec.key} - สั้นเกิน (ต้อง >= ${spec.minLen} ตัวอักษร, ปัจจุบัน ${v.length})`,
      );
    }
  }

  for (const group of optionalGroups) {
    if (group.name === 'LIFF') {
      const hasLiff =
        !!(env.NEXT_PUBLIC_LIFF_ID || env.LINE_LIFF_ID) &&
        !isPlaceholder(env.NEXT_PUBLIC_LIFF_ID || env.LINE_LIFF_ID || '');
      const hasChannel =
        !!env.LINE_LOGIN_CHANNEL_ID && !isPlaceholder(env.LINE_LOGIN_CHANNEL_ID);
      if ((hasLiff && !hasChannel) || (!hasLiff && hasChannel)) {
        errors.push(
          `[FAIL] LIFF - config LIFF ครึ่งเดียว (มี ${hasLiff ? 'LIFF ID' : 'LINE_LOGIN_CHANNEL_ID'}) - ต้องระบุทั้ง LIFF ID (NEXT_PUBLIC_LIFF_ID หรือ LINE_LIFF_ID) และ LINE_LOGIN_CHANNEL_ID หรือไม่ตั้งค่าเลย`,
        );
      }
      continue;
    }

    const set = group.keys.filter((k) => {
      const v = env[k];
      return !!v && !isPlaceholder(v);
    });
    if (set.length === 0 || set.length === group.keys.length) continue;
    for (const key of group.keys.filter((k) => !set.includes(k))) {
      errors.push(
        `[FAIL] ${key} - config ${group.name} ครึ่งเดียว (มี ${set.join(', ')}) - ต้องครบทั้ง ${group.keys.join(' + ')} หรือไม่ตั้งค่าเลย`,
      );
    }
  }

  if (isProd) {
    const u = env.AUTH_URL;
    if (!u) {
      errors.push('[FAIL] AUTH_URL - production ต้องระบุ canonical https URL');
    } else {
      try {
        const parsed = new URL(u);
        if (parsed.protocol !== 'https:') {
          errors.push(`[FAIL] AUTH_URL - production ต้องเป็น https:// (ปัจจุบัน: ${parsed.protocol}//)`);
        }
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
          errors.push('[FAIL] AUTH_URL - production ห้ามใช้ localhost (ตั้งเป็น canonical domain)');
        }
      } catch {
        errors.push(`[FAIL] AUTH_URL - URL ไม่ถูกต้อง (parse ไม่ผ่าน): ${u}`);
      }
    }

    // แจ้งเตือนเรื่อง SMTP แบบ non-blocking warning (ไม่บล็อก build)
    const smtpHost = env.SMTP_HOST;
    if (!smtpHost || isPlaceholder(smtpHost)) {
      warnings.push(
        '[WARN] SMTP_HOST - ยังไม่ได้ตั้งค่า SMTP สำหรับส่งอีเมลรีเซ็ตรหัสผ่าน (ฟังก์ชันลืมรหัสผ่านจะไม่ส่งอีเมล)',
      );
    }
  }

  return { errors, warnings };
}

const isDirectRun =
  process.argv[1] &&
  (fileURLToPath(import.meta.url) === process.argv[1] ||
    process.argv[1].endsWith('verify-env.ts') ||
    process.argv[1].endsWith('verify-env.js'));

if (isDirectRun) {
  const isProd = process.env.NODE_ENV === 'production';
  const { errors, warnings } = validateEnv(process.env, isProd);

  if (warnings.length > 0) {
    console.warn('\n[verify-env] คำเตือน:');
    for (const w of warnings) console.warn('  ' + w);
  }

  if (errors.length > 0) {
    console.error('\n[verify-env] BLOCKED - env ขาดหรือไม่ถูกต้อง:');
    for (const e of errors) console.error('  ' + e);
    console.error('\nดู .env.example สำหรับรายการเต็ม (คัดลอกเป็น .env.local)\n');
    process.exit(1);
  }

  console.log('[verify-env] [PASS] env vars ครบและถูกต้อง');
}
