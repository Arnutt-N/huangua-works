CREATE TYPE "public"."case_priority" AS ENUM('normal', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('received', 'reviewing', 'assigned', 'in_progress', 'done', 'closed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."update_type" AS ENUM('status_change', 'assignment', 'comment', 'attachment', 'metadata_change');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('citizen', 'officer', 'chief', 'head', 'superadmin');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"resource" text NOT NULL,
	"resource_id" text,
	"ip_address" text,
	"user_agent" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "case_stats_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"total_received" integer DEFAULT 0 NOT NULL,
	"total_closed" integer DEFAULT 0 NOT NULL,
	"total_rejected" integer DEFAULT 0 NOT NULL,
	"total_in_progress" integer DEFAULT 0 NOT NULL,
	"avg_resolution_days" integer,
	"by_department" jsonb,
	"by_category" jsonb,
	"metadata" jsonb,
	CONSTRAINT "case_stats_daily_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "case_updates" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"case_id" text NOT NULL,
	"user_id" text NOT NULL,
	"updateType" "update_type" NOT NULL,
	"old_value" text,
	"new_value" text,
	"comment" text,
	"attachments" jsonb,
	"is_public" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"status" "case_status" DEFAULT 'received' NOT NULL,
	"priority" "case_priority" DEFAULT 'normal' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"location" text NOT NULL,
	"category_id" text NOT NULL,
	"submitted_by" text NOT NULL,
	"assigned_to" text,
	"department_id" text,
	"due_date" timestamp,
	"closed_at" timestamp,
	"attachments" jsonb,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon" text,
	"default_department_id" text,
	"estimated_days" integer DEFAULT 7,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name"),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"consent_type" text NOT NULL,
	"version" text NOT NULL,
	"is_granted" boolean NOT NULL,
	"granted_at" timestamp,
	"revoked_at" timestamp,
	"ip_address" text,
	"user_agent" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "dedup_hashes" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"hash" text NOT NULL,
	"case_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "dedup_hashes_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"color" text,
	"icon" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "departments_name_unique" UNIQUE("name"),
	CONSTRAINT "departments_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" NOT NULL,
	"department_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"full_name" text NOT NULL,
	"phone_number" text,
	"metadata" jsonb,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "case_stats_daily_date_idx" ON "case_stats_daily" USING btree ("date");--> statement-breakpoint
CREATE INDEX "case_updates_case_id_idx" ON "case_updates" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "case_updates_user_id_idx" ON "case_updates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "case_updates_created_at_idx" ON "case_updates" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cases_status_idx" ON "cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cases_submitted_by_idx" ON "cases" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX "cases_assigned_to_idx" ON "cases" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "cases_category_id_idx" ON "cases" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "cases_department_id_idx" ON "cases" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "cases_created_at_idx" ON "cases" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "consent_records_user_id_idx" ON "consent_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "consent_records_consent_type_idx" ON "consent_records" USING btree ("consent_type");--> statement-breakpoint
CREATE INDEX "dedup_hashes_hash_idx" ON "dedup_hashes" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "dedup_hashes_expires_at_idx" ON "dedup_hashes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "departments_slug_idx" ON "departments" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_department_id_idx" ON "users" USING btree ("department_id");