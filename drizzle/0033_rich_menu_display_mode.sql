-- § เขียนมือเพราะ `drizzle-kit generate` พังมาก่อนหน้าแล้ว (snapshot 0019/0020/0021 ชน prevId)
ALTER TABLE "public"."rich_menus" ADD COLUMN IF NOT EXISTS "display_mode" text NOT NULL DEFAULT 'ALWAYS';--> statement-breakpoint
UPDATE "public"."rich_menus" SET "display_mode" = 'SCHEDULED' WHERE "display_start_at" IS NOT NULL OR "display_end_at" IS NOT NULL;
