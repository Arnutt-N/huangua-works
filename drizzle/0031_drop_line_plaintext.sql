-- ลบ plaintext LINE id หลัง backfill gap 0 ทั้งสองตาราง (irreversible — rollback = restore จาก backup เท่านั้น)
DROP INDEX IF EXISTS "public"."chat_conversations_line_user_id_idx";--> statement-breakpoint
ALTER TABLE "public"."chat_conversations" DROP COLUMN "line_user_id";--> statement-breakpoint
ALTER TABLE "public"."chat_conversations" ALTER COLUMN "line_user_id_hash" SET NOT NULL;--> statement-breakpoint
-- § partial index ใช้เป็น ON CONFLICT arbiter ไม่ได้ (Postgres 42P10) — hash เป็น NOT NULL
-- แล้วจึงเปลี่ยนเป็น full unique index ให้ race กันที่ hash ได้
DROP INDEX IF EXISTS "public"."chat_conversations_line_user_id_hash_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "chat_conversations_line_user_id_hash_idx" ON "public"."chat_conversations" USING btree ("line_user_id_hash");--> statement-breakpoint
DROP INDEX IF EXISTS "public"."line_users_line_user_id_idx";--> statement-breakpoint
ALTER TABLE "public"."line_users" DROP COLUMN "line_user_id";--> statement-breakpoint
ALTER TABLE "public"."line_users" ALTER COLUMN "line_user_id_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "public"."line_users" ALTER COLUMN "line_user_id_enc" SET NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "public"."line_users_line_user_id_hash_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "line_users_line_user_id_hash_idx" ON "public"."line_users" USING btree ("line_user_id_hash");
