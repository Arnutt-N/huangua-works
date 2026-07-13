ALTER TABLE "users" ADD COLUMN "auth_user_id" text;--> statement-breakpoint
CREATE INDEX "users_auth_user_id_idx" ON "users" USING btree ("auth_user_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_auth_user_id_unique" UNIQUE("auth_user_id");