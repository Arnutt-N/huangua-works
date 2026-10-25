-- § ปิด drift ที่ schema.ts นำหน้า SQL ไว้ — deploy ที่ replay ตาม _journal จะขาดสองอย่างนี้
ALTER TABLE "public"."chat_broadcasts" ADD COLUMN IF NOT EXISTS "title" text;--> statement-breakpoint
ALTER TYPE "public"."broadcast_status" ADD VALUE IF NOT EXISTS 'cancelled';
