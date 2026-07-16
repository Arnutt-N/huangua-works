ALTER TABLE "cases" ADD COLUMN "tracking_code" text;--> statement-breakpoint
CREATE UNIQUE INDEX "cases_tracking_code_idx" ON "cases" USING btree ("tracking_code") WHERE tracking_code IS NOT NULL;