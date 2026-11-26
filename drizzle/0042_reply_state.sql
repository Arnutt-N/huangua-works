-- § แยกสถานะการส่ง reply ออกจาก effects commitment — 'none'=ไม่มี reply ที่ต้องส่ง,
-- 'pending'=รอส่ง,'expired'=ใช้ token ไม่ได้แล้ว (terminal กัน cron รี retry ไม่จบ)
ALTER TABLE "line_webhook_events" ADD COLUMN "reply_state" text DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "line_webhook_events" ADD CONSTRAINT "line_webhook_events_reply_state_check" CHECK ("line_webhook_events"."reply_state" IN ('pending', 'none', 'expired'));
--> statement-breakpoint
UPDATE "line_webhook_events" SET "reply_state" = 'none' WHERE "status" IN ('done', 'failed') OR ("effects_committed_at" IS NOT NULL AND "pending_replies" IS NULL);
