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
  { key: 'NEXT_PUBLIC_SUPABASE_URL', label: 'Supabase project URL (public, client-safe)' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', label: 'Supabase anon key (public, client-safe)' },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    label: 'Supabase service role (SERVER-ONLY — ห้าม NEXT_PUBLIC_)',
    serverOnly: true,
    minLen: 32,
  },
  { key: 'UPSTASH_REDIS_REST_URL', label: 'Upstash Redis REST URL' },
  { key: 'UPSTASH_REDIS_REST_TOKEN', label: 'Upstash Redis REST token', minLen: 16 },
  { key: 'QSTASH_TOKEN', label: 'QStash token', minLen: 16 },
  { key: 'QSTASH_CURRENT_SIGNING_KEY', label: 'QStash current signing key' },
  { key: 'QSTASH_NEXT_SIGNING_KEY', label: 'QStash next signing key' },
  { key: 'CID_HMAC_KEY', label: 'CID keyed-HMAC key (C2 — ≥32 char)', minLen: 32 },
  { key: 'CRON_SECRET', label: 'Vercel Cron shared secret (≥16 char)', minLen: 16 },
];

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

console.log('[verify-env] ✓ env vars ครบและถูกต้อง');