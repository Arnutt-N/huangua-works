import { config } from 'dotenv';

/**
 * Integration test เท่านั้นที่ต้องพึ่งไฟล์นี้ (DATABASE_URL, Upstash Redis)
 * โหลดจาก .env.local ของเครื่อง dev — ต้องมี local Supabase stack + Redis รันอยู่
 * unit test (pure function) ไม่แตะ env พวกนี้อยู่แล้ว ไม่ได้รับผลกระทบ
 */
config({ path: '.env.local' });
