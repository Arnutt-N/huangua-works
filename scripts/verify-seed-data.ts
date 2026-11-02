#!/usr/bin/env tsx
import { config } from 'dotenv';
import { count, eq } from 'drizzle-orm';
import { getDb, closeDb } from '../src/lib/db';
import {
  users,
  departments,
  categories,
  provinces,
  districts,
  subDistricts,
  villages,
  chatIntents,
} from '../src/lib/db/schema';

// โหลด .env.local ก่อน แล้ว fallback เป็น .env
config({ path: '.env.local', override: false });
config({ path: '.env', override: false });

/**
 * verify-seed-data.ts - ตรวจสอบความสมบูรณ์ของ Master Data ในฐานข้อมูล
 * ออกแบบเพื่อความปลอดภัย:
 * - Read-only (SELECT count(*) เท่านั้น ไม่มีการเขียนหรือแก้ไขข้อมูล)
 * - ไม่เปิดเผยข้อมูล PII หรือ Token ออกหน้าจอ (มาสก์อีเมล)
 * - ปิด connection pool เสมอ (try/finally closeDb) ป้องกันคำสั่งค้าง
 */

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0]!;
  const domain = parts[1]!;
  const visible = name.slice(0, 2);
  return `${visible}***@${domain}`;
}

async function main() {
  console.log('============================================================');
  console.log(' ตรวจสอบข้อมูลตั้งต้น (Master Data Verification) - อบต.หัวงัว');
  console.log('============================================================\n');

  let hasErrors = false;

  try {
    const db = await getDb();

    // 1. ตรวจสอบ Superadmin
    const [adminCount] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, 'superadmin'));

    const superadmins = await db
      .select({ id: users.id, email: users.email, isActive: users.isActive })
      .from(users)
      .where(eq(users.role, 'superadmin'))
      .limit(3);

    const superadminTotal = adminCount?.count ?? 0;
    if (superadminTotal > 0) {
      const activeAdmin = superadmins.find((a) => a.isActive);
      const emailMasked = activeAdmin ? maskEmail(activeAdmin.email) : 'none';
      console.log(`[PASS] Superadmin: พบบัญชีผู้ดูแลระบบสูงสุด ${superadminTotal} บัญชี (ตัวอย่าง: ${emailMasked})`);
    } else {
      console.log('[FAIL] Superadmin: ไม่พบบัญชี superadmin ในระบบ (ต้องรัน npx tsx scripts/seed.ts)');
      hasErrors = true;
    }

    // 2. ตรวจสอบหน่วยงาน (Departments)
    const [deptCount] = await db.select({ count: count() }).from(departments);
    const totalDepts = deptCount?.count ?? 0;
    if (totalDepts > 0) {
      console.log(`[PASS] Departments: พบหน่วยงานทั้งหมด ${totalDepts} หน่วยงาน`);
    } else {
      console.log('[FAIL] Departments: ไม่พบข้อมูลหน่วยงาน (ต้องรัน npx tsx scripts/seed.ts)');
      hasErrors = true;
    }

    // 3. ตรวจสอบหมวดหมู่เรื่อง (Categories)
    const [catCount] = await db.select({ count: count() }).from(categories);
    const totalCats = catCount?.count ?? 0;
    if (totalCats > 0) {
      console.log(`[PASS] Categories: พบหมวดหมู่เรื่องทั้งหมด ${totalCats} หมวดหมู่`);
    } else {
      console.log('[FAIL] Categories: ไม่พบข้อมูลหมวดหมู่ (ต้องรัน npx tsx scripts/seed.ts)');
      hasErrors = true;
    }

    // 4. ตรวจสอบข้อมูลภูมิศาสตร์ (Geodata)
    const [provCount] = await db.select({ count: count() }).from(provinces);
    const [distCount] = await db.select({ count: count() }).from(districts);
    const [subDistCount] = await db.select({ count: count() }).from(subDistricts);
    const [villageCount] = await db.select({ count: count() }).from(villages);

    const totalProv = provCount?.count ?? 0;
    const totalDist = distCount?.count ?? 0;
    const totalSubDist = subDistCount?.count ?? 0;
    const totalVillages = villageCount?.count ?? 0;

    if (totalProv > 0 && totalDist > 0 && totalSubDist > 0) {
      console.log(
        `[PASS] Geodata (จังหวัด/อำเภอ/ตำบล): ${totalProv} จังหวัด, ${totalDist} อำเภอ, ${totalSubDist} ตำบล`,
      );
    } else {
      console.log('[WARN] Geodata (จังหวัด/อำเภอ/ตำบล): ข้อมูลภูมิศาสตร์ยังไม่ครบ (รัน npx tsx scripts/seed-geodata.ts)');
    }

    if (totalVillages > 0) {
      console.log(`[PASS] Villages: พบหมู่บ้าน ${totalVillages.toLocaleString('th-TH')} หมู่บ้าน`);
    } else {
      console.log('[WARN] Villages: ยังไม่มีข้อมูลหมู่บ้าน (รัน npx tsx scripts/seed-villages.ts)');
    }

    // 5. ตรวจสอบข้อมูล Chatbot FAQ
    const [faqCount] = await db.select({ count: count() }).from(chatIntents);
    const totalFaq = faqCount?.count ?? 0;
    if (totalFaq > 0) {
      console.log(`[PASS] Chatbot FAQ: พบ Intent สำหรับตอบคำถามประชาชน ${totalFaq} รายการ`);
    } else {
      console.log('[INFO] Chatbot FAQ: ยังไม่มี Intent คำถาม-คำตอบ (รัน npx tsx scripts/seed-faq.ts)');
    }

    console.log('\n------------------------------------------------------------');
    if (hasErrors) {
      console.log('[RESULT] FAILED: ข้อมูลหลักยังไม่พร้อมสำหรับ Production');
      process.exitCode = 1;
    } else {
      console.log('[RESULT] SUCCESS: ข้อมูล Master Data ครบถ้วนพร้อมใช้งาน');
    }
    console.log('------------------------------------------------------------\n');
  } catch (err) {
    console.error('\n[ERROR] ไม่สามารถเชื่อมต่อฐานข้อมูลได้:', err);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

void main();
