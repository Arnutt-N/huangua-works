import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

config({ path: '.env.local' });

const secrets = readFileSync('secrets/secret-keys.txt', 'utf8');
const emailMatch = secrets.match(/^email=(.+)$/m);
const email = emailMatch?.[1]?.trim();

if (!email) {
  console.error('superadmin email not found in secrets');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  // Check both the secret email and the default seed email
  const users = await sql`SELECT id, email, role, full_name, password_hash IS NOT NULL AS has_password FROM users WHERE email = ${email} OR email = 'admin@huangua.go.th' OR role = 'superadmin' ORDER BY role`;
  if (users.length === 0) {
    console.log('❌ ไม่มี superadmin ใน DB — ต้องรัน scripts/seed.ts ก่อน');
    console.log('   seed สร้าง: admin@huangua.go.th / ChangeMe123!');
  } else {
    console.log(`✅ พบ superadmin ${users.length} คน:`);
    for (const u of users) {
      console.log(`   - email: ${u.email} | role: ${u.role} | has_password: ${u.has_password} | name: ${u.full_name ?? 'N/A'}`);
    }
  }
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});