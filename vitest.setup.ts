/**
 * Integration test เท่านั้นที่ต้องพึ่งไฟล์นี้ (DATABASE_URL, Upstash Redis)
 * โหลดจาก .env.local ของเครื่อง dev — ต้องมี local Postgres + Redis รันอยู่
 * (เริ่ม service ด้วย `docker compose up -d postgres redis up-redis`)
 *
 * § unit suite ห้ามโหลด .env.local ของเครื่อง — ทำให้ test อ่าน config จริงของผู้ใช้
 *   และแต่ละ integration ใหม่ต้องจำวิธีปิด network ของตัวเอง (ข้อ 17)
 *   ตอนนี้โหลดเฉพาะเมื่อรันผ่าน vitest.integration.config.ts เท่านั้น
 */
if (process.env.VITEST_INTEGRATION === 'true') {
  const { config } = await import('dotenv');
  config({ path: '.env.local' });
}
