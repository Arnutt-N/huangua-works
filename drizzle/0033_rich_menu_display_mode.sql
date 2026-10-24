-- Tranche 4 (jsk line-menu parity): display mode ของ rich menu
-- § เขียนมือเพราะ `drizzle-kit generate` พังมาก่อนหน้าแล้ว (snapshot 0019/0020/0021 ชน prevId)
-- — apply ด้วย `npx drizzle-kit push` ตาม workflow ของ repo (ไม่มี db:migrate)
ALTER TABLE "public"."rich_menus" ADD COLUMN IF NOT EXISTS "display_mode" text NOT NULL DEFAULT 'ALWAYS';--> statement-breakpoint
-- § แถวเก่าที่มีช่วงเวลาแสดงผลอยู่แล้วคือ SCHEDULED โดยพฤติกรรมของ cron
UPDATE "public"."rich_menus" SET "display_mode" = 'SCHEDULED' WHERE "display_start_at" IS NOT NULL OR "display_end_at" IS NOT NULL;
