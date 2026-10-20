ALTER TABLE "public"."chat_conversations" ADD COLUMN "line_user_id_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_conversations_line_user_id_hash_idx" ON "public"."chat_conversations" USING btree ("line_user_id_hash") WHERE "line_user_id_hash" is not null;
