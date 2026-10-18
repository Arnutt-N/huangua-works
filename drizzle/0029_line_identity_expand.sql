ALTER TABLE "public"."line_users" ADD COLUMN "line_user_id_hash" text;--> statement-breakpoint
ALTER TABLE "public"."line_users" ADD COLUMN "line_user_id_enc" text;--> statement-breakpoint
ALTER TABLE "public"."line_users" ADD COLUMN "line_user_id_hash_v" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "line_users_line_user_id_hash_idx" ON "public"."line_users" USING btree ("line_user_id_hash") WHERE "line_user_id_hash" is not null;
