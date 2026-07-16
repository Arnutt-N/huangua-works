/**
 * Seed script — ข้อมูลเริ่มต้น (departments + categories + superadmin)
 * รันด้วย: pnpm tsx scripts/seed.ts
 */

import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { getDb, closeDb } from '../src/lib/db';
import { departments, categories, users } from '../src/lib/db/schema';
import { generateId } from '../src/lib/id';
import { hashPassword } from '../src/lib/password';

// § โหลด .env.local เพื่อให้ seed รันได้โดยไม่ต้อง export env ใน shell ทุกครั้ง
// (เหมือนที่ drizzle.config.ts / vitest.config.ts / playwright.config.ts ทำอยู่แล้ว)
config({ path: '.env.local', override: false });

const db = await getDb();

console.log('🌱 Seeding database...\n');

// ────────────────────────────────────────────────────────────────────────────
// § Departments (5 หน่วยงานหลัก)
// ────────────────────────────────────────────────────────────────────────────

const deptData = [
  {
    id: generateId(),
    name: 'สำนักปลัด',
    slug: 'clerk-office',
    description: 'งานธุรการ บุคคล การเงิน งานทะเบียนราษฎร',
    color: 'oklch(65% 0.21 245)',
    icon: 'Building2',
    isActive: true,
  },
  {
    id: generateId(),
    name: 'กองคลัง',
    slug: 'finance',
    description: 'งานการเงิน บัญชี จัดเก็บรายได้ พัสดุ',
    color: 'oklch(60% 0.18 120)',
    icon: 'Wallet',
    isActive: true,
  },
  {
    id: generateId(),
    name: 'กองช่าง',
    slug: 'public-works',
    description: 'งานก่อสร้าง ซ่อมบำรุง ถนน สะพาน อาคาร',
    color: 'oklch(58% 0.20 30)',
    icon: 'HardHat',
    isActive: true,
  },
  {
    id: generateId(),
    name: 'กองการศึกษา',
    slug: 'education',
    description: 'งานการศึกษา ศาสนา วัฒนธรรม กีฬา',
    color: 'oklch(62% 0.19 280)',
    icon: 'GraduationCap',
    isActive: true,
  },
  {
    id: generateId(),
    name: 'กำนัน-ผู้ใหญ่บ้าน',
    slug: 'village-heads',
    description: 'กำนัน ผู้ใหญ่บ้าน สมาชิก อบต.',
    color: 'oklch(55% 0.15 180)',
    icon: 'Users',
    isActive: true,
  },
];

const existingDept = (await db.select().from(departments).limit(1))[0];

if (existingDept) {
  console.log('⏭  Departments/categories มีอยู่แล้ว — ข้าม\n');
} else {
  await db.insert(departments).values(deptData);
  console.log(`✓ Inserted ${deptData.length} departments`);

  // § Categories (13 หมวดหมู่ตามแบบ Traffy)

  const publicWorksId = deptData[2]!.id; // กองช่าง
  const clerkId = deptData[0]!.id; // สำนักปลัด
  const educationId = deptData[3]!.id; // กองการศึกษา

  const categoryData = [
  {
    id: generateId(),
    name: 'ถนน-ทางเท้า',
    slug: 'roads-sidewalks',
    description: 'ถนนชำรุด หลุม ทางเท้าแตก',
    icon: 'Construction',
    defaultDepartmentId: publicWorksId,
    estimatedDays: 14,
    isActive: true,
  },
  {
    id: generateId(),
    name: 'ไฟฟ้า-แสงสว่าง',
    slug: 'electricity-lighting',
    description: 'ไฟถนนดับ ไฟสาธารณะ',
    icon: 'Lightbulb',
    defaultDepartmentId: publicWorksId,
    estimatedDays: 7,
    isActive: true,
  },
  {
    id: generateId(),
    name: 'น้ำประปา',
    slug: 'water-supply',
    description: 'ท่อแตก น้ำไม่ไหล คุณภาพน้ำ',
    icon: 'Droplet',
    defaultDepartmentId: publicWorksId,
    estimatedDays: 7,
    isActive: true,
  },
  {
    id: generateId(),
    name: 'ท่อระบายน้ำ',
    slug: 'drainage',
    description: 'ท่อตัน น้ำท่วม',
    icon: 'Waves',
    defaultDepartmentId: publicWorksId,
    estimatedDays: 10,
    isActive: true,
  },
  {
    id: generateId(),
    name: 'สวนสาธารณะ',
    slug: 'parks',
    description: 'สนามเด็กเล่น สนามกีฬา สวนสาธารณะ',
    icon: 'Trees',
    defaultDepartmentId: educationId,
    estimatedDays: 14,
    isActive: true,
  },
  {
    id: generateId(),
    name: 'ขยะ-สิ่งปฏิกูล',
    slug: 'waste-management',
    description: 'เก็บขยะไม่ทัน ขยะเกลื่อน',
    icon: 'Trash2',
    defaultDepartmentId: clerkId,
    estimatedDays: 3,
    isActive: true,
  },
  {
    id: generateId(),
    name: 'สิ่งแวดล้อม',
    slug: 'environment',
    description: 'มลพิษ กลิ่นเหม็น เสียงดัง',
    icon: 'Leaf',
    defaultDepartmentId: clerkId,
    estimatedDays: 7,
    isActive: true,
  },
  {
    id: generateId(),
    name: 'สุขภาพ-อนามัย',
    slug: 'health-sanitation',
    description: 'ห้องน้ำสาธารณะ ยุงลาย',
    icon: 'HeartPulse',
    defaultDepartmentId: clerkId,
    estimatedDays: 7,
    isActive: true,
  },
  {
    id: generateId(),
    name: 'สัตว์จรจัด',
    slug: 'stray-animals',
    description: 'สุนัขจรจัด สัตว์ตาย',
    icon: 'Dog',
    defaultDepartmentId: clerkId,
    estimatedDays: 3,
    isActive: true,
  },
  {
    id: generateId(),
    name: 'ป้ายโฆษณา',
    slug: 'signage',
    description: 'ป้ายชำรุด ไม่มีใบอนุญาต',
    icon: 'Square',
    defaultDepartmentId: clerkId,
    estimatedDays: 14,
    isActive: true,
  },
  {
    id: generateId(),
    name: 'การจราจร',
    slug: 'traffic',
    description: 'รถจอดผิดที่ ป้ายจราจรชำรุด',
    icon: 'TrafficCone',
    defaultDepartmentId: clerkId,
    estimatedDays: 7,
    isActive: true,
  },
  {
    id: generateId(),
    name: 'สังคม-สวัสดิการ',
    slug: 'social-welfare',
    description: 'ผู้สูงอายุ ผู้พิการ เด็ก',
    icon: 'Heart',
    defaultDepartmentId: clerkId,
    estimatedDays: 14,
    isActive: true,
  },
  {
    id: generateId(),
    name: 'อื่นๆ',
    slug: 'others',
    description: 'เรื่องอื่นๆ ที่ไม่อยู่ในหมวดข้างต้น',
    icon: 'MoreHorizontal',
    defaultDepartmentId: clerkId,
    estimatedDays: 7,
    isActive: true,
  },
];

  await db.insert(categories).values(categoryData);
  console.log(`✓ Inserted ${categoryData.length} categories`);
}

// ────────────────────────────────────────────────────────────────────────────
// § Superadmin user (DB row + bcrypt hash ใน users.password_hash)
// ────────────────────────────────────────────────────────────────────────────

const clerkDept = (
  await db.select().from(departments).where(eq(departments.slug, 'clerk-office')).limit(1)
)[0];

const superadminEmail = 'admin@huangua.go.th';
const superadminPassword = 'ChangeMe123!'; // local dev เท่านั้น — เปลี่ยนก่อนใช้งานจริง

const existingSuperadmin = (
  await db.select().from(users).where(eq(users.email, superadminEmail)).limit(1)
)[0];

if (existingSuperadmin?.passwordHash) {
  console.log(`⏭  Superadmin (${superadminEmail}) มี password hash อยู่แล้ว — ข้าม`);
} else {
  // § hash รหัสผ่านด้วย bcrypt (ทำใน seed ไม่ใช่ใน authorize callback — ทำครั้งเดียวตอน provision)
  const passwordHash = await hashPassword(superadminPassword);

  if (existingSuperadmin) {
    // แถวมีอยู่แล้ว (seed ไว้ก่อนเพิ่มฟีเจอร์ auth) — ใส่ passwordHash เข้าแถวเดิม ไม่สร้างซ้ำ
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, existingSuperadmin.id));
    console.log(`✓ Set password hash บน superadmin เดิม (${existingSuperadmin.id})`);
  } else {
    const superadminId = generateId();

    await db.insert(users).values({
      id: superadminId,
      email: superadminEmail,
      role: 'superadmin',
      departmentId: clerkDept?.id,
      isActive: true,
      fullName: 'ผู้ดูแลระบบ',
      phoneNumber: '043-000-0000',
      metadata: JSON.stringify({ createdBy: 'seed' }),
      passwordHash,
    });

    console.log(`✓ Inserted superadmin user (${superadminId})`);
  }

  console.log(`  Login: ${superadminEmail} / ${superadminPassword}`);
}

console.log('\n🎉 Seed completed!\n');
console.log('Next steps:');
console.log('  1. Start dev server: pnpm dev');
console.log('  2. Visit: http://localhost:3000');
console.log('  3. Test case submission flow\n');

// ปิด connection pool หลัง seed เสร็จ เพื่อให้ process exit อัตโนมัติ
await closeDb();
