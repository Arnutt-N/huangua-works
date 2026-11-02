CREATE TYPE "public"."queue_category" AS ENUM('technician', 'government');--> statement-breakpoint
DROP INDEX "queue_bookings_date_slot_idx";--> statement-breakpoint
ALTER TABLE "queue_bookings" ADD COLUMN "category" "queue_category" DEFAULT 'technician' NOT NULL;--> statement-breakpoint
ALTER TABLE "queue_bookings" ADD COLUMN "village_id" text;--> statement-breakpoint
ALTER TABLE "queue_bookings" ADD COLUMN "line_user_id_hash" text;--> statement-breakpoint
ALTER TABLE "queue_bookings" ADD COLUMN "line_user_id_enc" text;--> statement-breakpoint
ALTER TABLE "queue_bookings" ADD COLUMN "line_notification_status" text;--> statement-breakpoint
ALTER TABLE "queue_bookings" ADD COLUMN "line_notification_at" timestamp;--> statement-breakpoint
CREATE INDEX "queue_bookings_category_idx" ON "queue_bookings" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "queue_bookings_date_slot_category_idx" ON "queue_bookings" USING btree ("category","booking_date","slot") WHERE status <> 'cancelled';