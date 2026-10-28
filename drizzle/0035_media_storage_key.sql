-- § storage_key เป็นแหล่งความจริงของที่อยู่ไฟล์ แทน URL เต็มที่เซ็นไม่ได้
-- url / media_url ยังคงอยู่เพื่อ fallback ของแถวก่อน backfill (scripts/backfill-media-storage-key.ts)
-- nullable: แถวเดิมยังไม่มีค่า และข้อความล้วนไม่มีไฟล์
ALTER TABLE "public"."media_files" ADD COLUMN IF NOT EXISTS "storage_key" text;--> statement-breakpoint
ALTER TABLE "public"."chat_messages" ADD COLUMN IF NOT EXISTS "storage_key" text;
