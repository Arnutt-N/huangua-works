CREATE TYPE "public"."chat_message_type" AS ENUM('text', 'image', 'location', 'sticker', 'flex', 'template', 'system');--> statement-breakpoint
CREATE TYPE "public"."chat_sender" AS ENUM('user', 'bot', 'admin', 'system');--> statement-breakpoint
CREATE TYPE "public"."conversation_mode" AS ENUM('bot_active', 'waiting_handoff', 'human_active', 'resolved');--> statement-breakpoint
CREATE TABLE "chat_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"line_user_id" text NOT NULL,
	"mode" "conversation_mode" DEFAULT 'bot_active' NOT NULL,
	"assigned_admin_id" text,
	"assigned_at" timestamp,
	"linked_case_id" text,
	"unread_admin" integer DEFAULT 0 NOT NULL,
	"last_message_text" text,
	"last_message_at" timestamp,
	"last_message_sender" "chat_sender",
	"resolved_at" timestamp,
	"metadata" jsonb,
	CONSTRAINT "chat_conversations_line_user_id_unique" UNIQUE("line_user_id")
);
--> statement-breakpoint
CREATE TABLE "chat_faq" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"keywords" jsonb NOT NULL,
	"category_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"conversation_id" text NOT NULL,
	"sender" "chat_sender" NOT NULL,
	"message_type" "chat_message_type" DEFAULT 'text' NOT NULL,
	"text_content" text,
	"media_url" text,
	"flex_payload" jsonb,
	"location_data" jsonb,
	"line_message_id" text,
	"admin_user_id" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "chat_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	CONSTRAINT "chat_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "line_users" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"line_user_id" text NOT NULL,
	"display_name" text,
	"picture_url" text,
	"linked_user_id" text,
	"bot_state" jsonb,
	"last_message_at" timestamp,
	"metadata" jsonb,
	CONSTRAINT "line_users_line_user_id_unique" UNIQUE("line_user_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "chat_conversations_line_user_id_idx" ON "chat_conversations" USING btree ("line_user_id");--> statement-breakpoint
CREATE INDEX "chat_conversations_mode_idx" ON "chat_conversations" USING btree ("mode");--> statement-breakpoint
CREATE INDEX "chat_conversations_assigned_admin_id_idx" ON "chat_conversations" USING btree ("assigned_admin_id");--> statement-breakpoint
CREATE INDEX "chat_conversations_last_message_at_idx" ON "chat_conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "chat_faq_is_active_idx" ON "chat_faq" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "chat_messages_conversation_id_idx" ON "chat_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "chat_messages_line_message_id_idx" ON "chat_messages" USING btree ("line_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_settings_key_idx" ON "chat_settings" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "line_users_line_user_id_idx" ON "line_users" USING btree ("line_user_id");--> statement-breakpoint
CREATE INDEX "line_users_linked_user_id_idx" ON "line_users" USING btree ("linked_user_id");