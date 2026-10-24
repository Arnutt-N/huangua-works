-- Tranche 3 (jsk line-menu parity): canned responses + reply objects
-- § เขียนมือเพราะ `drizzle-kit generate` พังมาก่อนหน้าแล้ว (snapshot 0019/0020/0021 ชน prevId)
-- — apply ด้วย `npx drizzle-kit push` ตาม workflow ของ repo (ไม่มี db:migrate)
ALTER TABLE "public"."chat_canned_responses" ADD COLUMN IF NOT EXISTS "category" text NOT NULL DEFAULT 'info';--> statement-breakpoint
ALTER TABLE "public"."chat_canned_responses" ADD COLUMN IF NOT EXISTS "usage_count" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "public"."chat_reply_objects" ADD COLUMN IF NOT EXISTS "name" text;--> statement-breakpoint
ALTER TABLE "public"."chat_reply_objects" ADD COLUMN IF NOT EXISTS "category" text;
