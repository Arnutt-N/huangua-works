ALTER TABLE "case_notifications" ADD COLUMN "lease_owner" text;--> statement-breakpoint
ALTER TABLE "case_notifications" ADD COLUMN "claimed_until" timestamp;--> statement-breakpoint
ALTER TABLE "case_notifications" ADD COLUMN "next_attempt_at" timestamp;--> statement-breakpoint
CREATE INDEX "case_notifications_due_idx" ON "case_notifications" USING btree ("status","next_attempt_at");