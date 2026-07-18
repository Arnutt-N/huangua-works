#!/usr/bin/env tsx
/**
 * verify-env.ts — validate required env vars ทุกตัว ตอน build/boot (C2, C3)
 * ขาดหรือไม่ถูกต้อง = fail fast (exit 1) บล็อก deploy ไม่ปล่อยให้ต่อ
 *
 * วิ่งใน build script: `next build && tsx scripts/verify-env.ts`
 * หรือ manual: `pnpm verify-env`
 */

type Spec = {
  key: string;
  label: string;
  minLen?: number;
  serverOnly?: boolean;
};

const required: Spec[] = [
  {
    key: 'AUTH_SECRET',
    label: 'Auth.js JWT signing secret (SERVER-ONLY — ห้าม NEXT_PUBLIC_)',
    serverOnly: true,
    minLen: 32,
  },
  { key: 'AUTH_URL', label: 'Auth.js trusted app URL (e.g. http://localhost:3000)' },
  { key: 'UPSTASH_REDIS_REST_URL', label: 'Upstash Redis REST URL' },
  { key: 'UPSTASH_REDIS_REST_TOKEN', label: 'Upstash Redis REST token', minLen: 16 },
  { key: 'CID_HMAC_KEY', label: 'CID keyed-HMAC key (C2 — ≥32 char)', minLen: 32 },
  { key: 'CRON_SECRET', label: 'Cron shared secret (Authorization: Bearer — ≥16 char)', minLen: 16 },
];

// § QStash env (QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY)
// ไม่ได้ใช้ที่ runtime อีกต่อไป (cron รันผ่าน external scheduler เช่น cron-job.org ที่ตรวจ
// CRON_SECRET ผ่าน header Authorization แทน signature verification) → ไม่บังคับตอน build
// ถ้าในอนาคตกลับไปใช้ QStash Receiver.verify() ให้เพิ่มกลับเข้ามาใน required[] ข้างบน

const errors: string[] = [];

for (const spec of required) {
  const v = process.env[spec.key];
  if (!v || v.startsWith('YOUR_') || v.startsWith('CHANGE_ME')) {
    errors.push(`✗ ${spec.key} — ${spec.label} (ยังเป็น placeholder)`);
    continue;
  }
  if (spec.serverOnly && spec.key.startsWith('NEXT_PUBLIC_')) {
    errors.push(
      `✗ ${spec.key} — SERVER-ONLY secret ห้ามมีคำนำหน้า NEXT_PUBLIC_ (จะรั่วสู่ client bundle)`,
    );
  }
  if (spec.minLen && v.length < spec.minLen) {
    errors.push(
      `✗ ${spec.key} — สั้นเกิน (ต้อง ≥${spec.minLen} char, ปัจจุบัน ${v.length})`,
    );
  }
}

if (errors.length > 0) {
  console.error('\n[verify-env] BLOCKED — env ขาดหรือไม่ถูกต้อง:');
  for (const e of errors) console.error('  ' + e);
  console.error('\nดู .env.example สำหรับรายการเต็ม (คัดลอกเป็น .env.local)\n');
  process.exit(1);
}

// § Production-only: AUTH_URL ต้องเป็น https:// + canonical domain (ไม่ใช่ localhost)
// กัน deploy จริงที่ AUTH_URL ยังเป็น placeholder localhost → secure-cookie flag off + callback URL พัง
if (process.env.NODE_ENV === 'production') {
  const u = process.env.AUTH_URL;
  if (!u) {
    console.error('✗ AUTH_URL — production ต้องระบุ canonical https URL');
    process.exit(1);
  }
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== 'https:') {
      console.error(`✗ AUTH_URL — production ต้องเป็น https:// (ปัจจุบัน: ${parsed.protocol}//)`);
      process.exit(1);
    }
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      console.error('✗ AUTH_URL — production ห้ามใช้ localhost (ตั้งเป็น canonical domain)');
      process.exit(1);
    }
  } catch {
    console.error(`✗ AUTH_URL — URL ไม่ถูกต้อง (parse ไม่ผ่าน): ${u}`);
    process.exit(1);
  }
}

console.log('[verify-env] ✓ env vars ครบและถูกต้อง');