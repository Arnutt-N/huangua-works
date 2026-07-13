-- เปิด RLS แบบ default-deny ทุกตาราง — ไม่มี policy ให้ anon/authenticated เลย
--
-- เหตุผล: app query ทุกจุดต่อผ่าน Drizzle+postgres-js ด้วย DATABASE_URL role "postgres"
-- (Postgres superuser ของ local Supabase stack) ซึ่ง bypass RLS เสมอไม่ว่าจะมี policy
-- หรือไม่ก็ตาม — ดังนั้น RLS ที่นี่ไม่ได้ป้องกัน query path ของแอปเอง (ยังทำงานปกติ)
--
-- สิ่งที่ RLS + REVOKE นี้ป้องกันจริง: การเพิ่ม @supabase/ssr client ฝั่ง browser ทำให้
-- NEXT_PUBLIC_SUPABASE_ANON_KEY หลุดออกไปอยู่ใน bundle ของ browser เป็นครั้งแรก และ
-- PostgREST API ที่ port 54321 (ตาม supabase/config.toml) เปิดรับ request จริงอยู่แล้ว
-- ถ้าไม่ปิดตรงนี้ ใครก็ตามที่ดึง anon key จาก bundle ออกมาได้ จะยิง
-- GET/POST /rest/v1/cases (หรือตารางอื่น) ตรงได้เลย ข้าม rate-limit/dedup/validation
-- ทั้งหมดที่ทำไว้ใน Next.js server ฝั่งแอป — RLS + REVOKE นี้ปิดช่องทางนั้นให้เหลือ
-- แค่ service_role (bypass RLS โดย design ของ Supabase อยู่แล้ว ไม่ต้องมี policy)
--
-- ไม่ใช้ FORCE ROW LEVEL SECURITY เพราะไม่มีผลกับ superuser/table owner อยู่ดี
-- (Postgres เอกสารระบุชัดว่า FORCE ไม่กระทบ superuser) และถ้าอนาคตมีคนเปลี่ยน
-- DATABASE_URL ไปใช้ role ที่ไม่ใช่ superuser FORCE จะเริ่มบล็อกแอปเองโดยไม่ตั้งใจ

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "case_updates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dedup_hashes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "case_stats_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
