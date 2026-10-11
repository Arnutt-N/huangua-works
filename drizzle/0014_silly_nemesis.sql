ALTER TYPE "public"."case_status" ADD VALUE 'awaiting_budget' BEFORE 'assigned';--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"source_sha256" text NOT NULL,
	"file_name" text NOT NULL,
	"row_count" integer NOT NULL,
	"imported_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"operator_user_id" text NOT NULL,
	"notes" text,
	CONSTRAINT "import_batches_source_sha256_unique" UNIQUE("source_sha256")
);
--> statement-breakpoint
CREATE TABLE "legacy_responsible_map" (
	"raw" text PRIMARY KEY NOT NULL,
	"department_id" text,
	"assigned_to" text,
	"decided_by" text NOT NULL,
	"decided_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_updates" ALTER COLUMN "is_public" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "source_key" text;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "import_batch_id" text;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "legacy_submitter_name" text;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "is_historical" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "import_batches_source_sha256_idx" ON "import_batches" USING btree ("source_sha256");--> statement-breakpoint
CREATE INDEX "legacy_responsible_map_department_id_idx" ON "legacy_responsible_map" USING btree ("department_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cases_source_key_idx" ON "cases" USING btree ("source_key") WHERE source_key IS NOT NULL;--> statement-breakpoint
CREATE INDEX "cases_import_batch_id_idx" ON "cases" USING btree ("import_batch_id");--> statement-breakpoint
CREATE INDEX "cases_is_historical_idx" ON "cases" USING btree ("is_historical");