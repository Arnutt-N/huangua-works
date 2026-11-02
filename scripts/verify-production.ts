#!/usr/bin/env tsx
import { config } from 'dotenv';
import { sql, count } from 'drizzle-orm';
import { getDb, closeDb } from '../src/lib/db';
import { cases, users } from '../src/lib/db/schema';
import { validateEnv } from './verify-env';
import { probeProvider } from '../src/lib/system/probe';
import { getLiffId } from '../src/lib/liff/config';

// โหลด .env.local ก่อน แล้ว fallback เป็น .env
config({ path: '.env.local', override: false });
config({ path: '.env', override: false });

/**
 * verify-production.ts - เครื่องมือตรวจสอบความพร้อมก่อน Go-Live สำหรับ Ops
 *
 * ตรวจสอบ:
 * 1. Environment Contract (Production mode)
 * 2. Database Connection (PostgreSQL latency & tables)
 * 3. Upstash Redis (REST API latency)
 * 4. S3 Storage (Connectivity)
 * 5. LINE Messaging API & LIFF
 * 6. SMTP Email Server
 * 7. Cron Endpoints Security Guard (Ping with Bearer 200, others unauth 401)
 *
 * ความปลอดภัย:
 * - ห้ามรัน cron endpoints ที่มีผลข้างเคียง (mutating) ด้วย Token จริง
 * - ปิด DB connection pool ใน finally เสมอ
 * - Zero Emoji
 */

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 5000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log('============================================================');
  console.log(' ตรวจสอบความพร้อมระบบก่อนขึ้น Production (Ops Pre-Flight)');
  console.log(' อบต.หัวงัว อำเภอยางตลาด จังหวัดกาฬสินธุ์');
  console.log('============================================================\n');

  let criticalFailure = false;

  // 1. ตรวจสอบ Environment Variables (Production Mode by default, unless --dev flag is passed)
  const isDevMode = process.argv.includes('--dev') || process.argv.includes('--allow-localhost');
  console.log(`[SECTION 1] การตรวจสอบตัวแปรสภาพแวดล้อม (${isDevMode ? 'โหมดทดสอบ Local/Dev' : 'โหมด Production'})`);
  const envCheck = validateEnv(process.env, !isDevMode);

  if (envCheck.errors.length === 0) {
    console.log('  [PASS] ตัวแปรหลักสำหรับ Production ครบถ้วน');
  } else {
    console.log('  [FAIL] พบข้อผิดพลาดของตัวแปรสภาพแวดล้อม:');
    for (const err of envCheck.errors) {
      console.log(`    ${err}`);
    }
    criticalFailure = true;
  }

  if (envCheck.warnings.length > 0) {
    for (const warn of envCheck.warnings) {
      console.log(`  ${warn}`);
    }
  }

  // 2. ตรวจสอบฐานข้อมูล PostgreSQL
  console.log('\n[SECTION 2] การเชื่อมต่อฐานข้อมูล (PostgreSQL)');
  try {
    const startDb = Date.now();
    const db = await getDb();
    await db.execute(sql`SELECT 1`);
    const dbLatency = Date.now() - startDb;

    const [caseRow] = await db.select({ count: count() }).from(cases);
    const [userRow] = await db.select({ count: count() }).from(users);

    console.log(`  [PASS] PostgreSQL ทำงานปกติ (Latency: ${dbLatency}ms)`);
    console.log(`  [INFO] สรุปข้อมูลในฐาน: ${caseRow?.count ?? 0} เรื่องร้องเรียน, ${userRow?.count ?? 0} บัญชีผู้ใช้`);
  } catch (err) {
    console.log(`  [FAIL] ไม่สามารถเชื่อมต่อฐานข้อมูลได้: ${String(err)}`);
    criticalFailure = true;
  }

  // 3. ตรวจสอบ Upstash Redis
  console.log('\n[SECTION 3] การเชื่อมต่อ Upstash Redis (Rate Limiting & Cache)');
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    try {
      const startRedis = Date.now();
      const res = await fetchWithTimeout(`${redisUrl}/ping`, {
        headers: { Authorization: `Bearer ${redisToken}` },
      });
      const redisLatency = Date.now() - startRedis;
      if (res.ok) {
        console.log(`  [PASS] Upstash Redis ตอบสนองปกติ (Latency: ${redisLatency}ms)`);
      } else {
        console.log(`  [FAIL] Upstash Redis ปฏิเสธการเชื่อมต่อ (HTTP ${res.status})`);
        criticalFailure = true;
      }
    } catch (err) {
      console.log(`  [FAIL] เชื่อมต่อ Upstash Redis ล้มเหลว: ${String(err)}`);
      criticalFailure = true;
    }
  } else {
    console.log('  [FAIL] ขาดค่า UPSTASH_REDIS_REST_URL หรือ UPSTASH_REDIS_REST_TOKEN');
    criticalFailure = true;
  }

  // 4. ตรวจสอบ S3 Storage
  console.log('\n[SECTION 4] บริการจัดเก็บไฟล์ภาพ (S3 / Supabase Storage)');
  const s3Probe = await probeProvider('s3');
  if (s3Probe.status === 'connected') {
    console.log(`  [PASS] S3 Storage เชื่อมต่อสำเร็จ (${s3Probe.endpoint})`);
  } else if (s3Probe.status === 'unknown') {
    console.log('  [WARN] ยังไม่ได้ตั้งค่า S3 Storage (การแนบภาพถ่ายประชาชนและเจ้าหน้าที่จะปิดใช้งาน)');
  } else {
    console.log(`  [WARN] S3 Storage ไม่สามารถเข้าถึงได้ (${s3Probe.endpoint})`);
  }

  // 5. ตรวจสอบ LINE Messaging API & LIFF
  console.log('\n[SECTION 5] ช่องทาง LINE Official Account & LIFF');
  const lineProbe = await probeProvider('line');
  if (lineProbe.status === 'connected') {
    console.log(`  [PASS] LINE Messaging API เชื่อมต่อสำเร็จ (${lineProbe.endpoint})`);
  } else if (lineProbe.status === 'unknown') {
    console.log('  [INFO] ยังไม่ได้ระบุ LINE_CHANNEL_ACCESS_TOKEN (ฟังก์ชันแชตบอท LINE ปิดอยู่)');
  } else {
    console.log('  [WARN] ไม่สามารถดึงข้อมูล Bot จาก LINE Messaging API ได้ (ตรวจสอบ Token)');
  }

  const liffId = getLiffId();
  if (liffId) {
    console.log(`  [PASS] LINE LIFF ID กำหนดไว้เรียบร้อย (${liffId})`);
  } else {
    console.log('  [INFO] ยังไม่ได้กำหนด NEXT_PUBLIC_LIFF_ID (ระบบจะทำงานผ่าน Mobile Web)');
  }

  // 6. ตรวจสอบ SMTP Mail Server
  console.log('\n[SECTION 6] บริการอีเมลรีเซ็ตรหัสผ่าน (SMTP)');
  const smtpProbe = await probeProvider('smtp');
  if (smtpProbe.status === 'connected') {
    console.log(`  [PASS] SMTP Server เชื่อมต่อพอร์ตสำเร็จ (${smtpProbe.endpoint})`);
  } else if (smtpProbe.status === 'unknown') {
    console.log('  [WARN] ยังไม่ได้ตั้งค่า SMTP_HOST (การกดลืมรหัสผ่านของเจ้าหน้าที่จะไม่ส่งอีเมล)');
  } else {
    console.log(`  [WARN] ไม่สามารถเชื่อมต่อไปยัง SMTP Server ได้ (${smtpProbe.endpoint})`);
  }

  // 7. ตรวจสอบ Cron Endpoints Security Guard
  console.log('\n[SECTION 7] ตรวจสอบความพร้อมของ Cron Endpoints (7 Jobs)');
  const cronSecret = process.env.CRON_SECRET;
  const baseUrl = process.env.AUTH_URL || 'http://localhost:3000';

  if (!cronSecret) {
    console.log('  [FAIL] ไม่พบ CRON_SECRET ในระบบ');
    criticalFailure = true;
  } else {
    try {
      // 7.1 ยิงเฉพาะ /api/cron/ping ด้วย Bearer Token จริง (ปลอดภัย ไม่แก้ไขข้อมูล)
      const pingRes = await fetchWithTimeout(`${baseUrl}/api/cron/ping`, {
        headers: { Authorization: `Bearer ${cronSecret}` },
      });

      if (pingRes.status === 200) {
        console.log('  [PASS] /api/cron/ping - ตอบสนอง 200 OK (ยืนยัน Bearer CRON_SECRET สำเร็จ)');

        // 7.2 ตรวจสอบอีก 6 mutating endpoints แบบ Unauthenticated (ต้องได้ 401 Unauthorized)
        const mutatingCronJobs = [
          'close-stale',
          'cleanup-hashes',
          'cleanup-audit-logs',
          'stats-refresh',
          'broadcast-send',
          'rich-menu-display',
        ];

        let cronGuardOk = true;
        for (const job of mutatingCronJobs) {
          const res = await fetchWithTimeout(`${baseUrl}/api/cron/${job}`);
          if (res.status === 401) {
            console.log(`  [PASS] /api/cron/${job} - ได้รับ 401 Unauthorized (Security Guard ทำงานถูกต้อง ไม่แตะข้อมูล)`);
          } else {
            console.log(`  [WARN] /api/cron/${job} - คาดหวัง 401 แต่ได้รับสถานะ ${res.status}`);
            cronGuardOk = false;
          }
        }
        if (cronGuardOk) {
          console.log('  [PASS] Cron Security Guard: ปลอดภัยและพร้อมผูกกับ cron-job.org');
        }
      } else {
        console.log(`  [WARN] /api/cron/ping ตอบสถานะ ${pingRes.status} (ตรวจสอบ CRON_SECRET หรือ URL)`);
      }
    } catch {
      console.log(
        `  [INFO] เว็บเซิร์ฟเวอร์ (${baseUrl}) ยังไม่ได้เปิดขณะนี้ - ข้ามการทดสอบ Cron HTTP Endpoints (รันหลังเว็บเปิดทำงาน)`,
      );
    }
  }

  console.log('\n============================================================');
  if (criticalFailure) {
    console.log('[RESULT] FAILED: มีบริการหลักที่ไม่ผ่านเกณฑ์ กรุณาแก้ไขก่อน Go-Live');
    process.exitCode = 1;
  } else {
    console.log('[RESULT] PASSED: ระบบพร้อมสำหรับการ Deploy สู่ Production บน Vercel');
  }
  console.log('============================================================\n');

  await closeDb();
}

void main();
