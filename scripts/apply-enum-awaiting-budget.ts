/**
 * เพิ่มค่า enum ใหม่แบบนอก transaction
 *
 * § PostgreSQL ห้าม ALTER TYPE ... ADD VALUE ใน transaction block — drizzle-kit
 * push/migrate ครอบทุก statement ด้วย transaction จึงพังเสมอ ต้องรันคำสั่งนี้ก่อน
 * push เสมอ (ทั้ง local และ production) push แบบ diff จะข้ามส่วนที่ตรงแล้วเอง
 *
 * รันด้วย: npx tsx scripts/apply-enum-awaiting-budget.ts
 */

import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local', override: false });

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const sql = postgres(url);

const existing = await sql<{ label: string }[]>`
  SELECT enumlabel AS label FROM pg_enum
  WHERE enumtypid = 'public.case_status'::regtype
`;
if (existing.some((r) => r.label === 'awaiting_budget')) {
  console.log('case_status มี awaiting_budget แล้ว ข้าม');
} else {
  // § statement เดียว auto-commit ห้ามครอบ BEGIN/COMMIT เด็ดขาด
  await sql.unsafe(
    `ALTER TYPE "public"."case_status" ADD VALUE 'awaiting_budget' BEFORE 'assigned'`,
  );
  console.log('เพิ่ม awaiting_budget ใน case_status แล้ว');
}
await sql.end();
