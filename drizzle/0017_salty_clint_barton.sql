CREATE TABLE "api_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"provider" text NOT NULL,
	"endpoint" text NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"last_checked_at" timestamp,
	"metadata" jsonb,
	CONSTRAINT "api_connections_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "org_id" text DEFAULT 'huangua' NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "org_id" text DEFAULT 'huangua' NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "org_id" text DEFAULT 'huangua' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "org_id" text DEFAULT 'huangua' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "api_connections_provider_idx" ON "api_connections" USING btree ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "system_settings_key_idx" ON "system_settings" USING btree ("key");--> statement-breakpoint
CREATE INDEX "cases_org_id_idx" ON "cases" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "categories_org_id_idx" ON "categories" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "departments_org_id_idx" ON "departments" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "users_org_id_idx" ON "users" USING btree ("org_id");