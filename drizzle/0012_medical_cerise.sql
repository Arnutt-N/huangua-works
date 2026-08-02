CREATE TYPE "public"."broadcast_status" AS ENUM('draft', 'scheduled', 'sending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."intent_reply_type" AS ENUM('text', 'reply_object');--> statement-breakpoint
CREATE TYPE "public"."match_type" AS ENUM('exact', 'starts_with', 'contains', 'regex');--> statement-breakpoint
CREATE TYPE "public"."media_category" AS ENUM('rich_menu', 'image_message', 'general');--> statement-breakpoint
CREATE TYPE "public"."reply_object_type" AS ENUM('flex', 'template', 'text', 'image');--> statement-breakpoint
CREATE TYPE "public"."rich_menu_status" AS ENUM('draft', 'active', 'inactive');--> statement-breakpoint
CREATE TABLE "chat_broadcasts" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"content" jsonb NOT NULL,
	"status" "broadcast_status" DEFAULT 'draft' NOT NULL,
	"target" text DEFAULT 'all' NOT NULL,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"total_recipients" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "chat_intent_keywords" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"intent_id" text NOT NULL,
	"keyword" text NOT NULL,
	"match_type" "match_type" DEFAULT 'contains' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_intent_responses" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"intent_id" text NOT NULL,
	"reply_type" "intent_reply_type" DEFAULT 'text' NOT NULL,
	"text_content" text,
	"reply_object_id" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_intents" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "chat_intents_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "chat_reply_objects" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"object_id" text NOT NULL,
	"object_type" "reply_object_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"alt_text" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	CONSTRAINT "chat_reply_objects_object_id_unique" UNIQUE("object_id")
);
--> statement-breakpoint
CREATE TABLE "media_files" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"url" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"category" "media_category" DEFAULT 'general' NOT NULL,
	"uploaded_by" text
);
--> statement-breakpoint
CREATE TABLE "rich_menus" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"chat_bar_text" text DEFAULT 'เมนู' NOT NULL,
	"config" jsonb NOT NULL,
	"line_rich_menu_id" text,
	"image_url" text,
	"status" "rich_menu_status" DEFAULT 'draft' NOT NULL,
	"sync_status" text DEFAULT 'pending' NOT NULL,
	"last_sync_error" text,
	"created_by" text,
	CONSTRAINT "rich_menus_line_rich_menu_id_unique" UNIQUE("line_rich_menu_id")
);
--> statement-breakpoint
ALTER TABLE "chat_intent_keywords" ADD CONSTRAINT "chat_intent_keywords_intent_id_chat_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."chat_intents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_intent_responses" ADD CONSTRAINT "chat_intent_responses_intent_id_chat_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."chat_intents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_intent_responses" ADD CONSTRAINT "chat_intent_responses_reply_object_id_chat_reply_objects_id_fk" FOREIGN KEY ("reply_object_id") REFERENCES "public"."chat_reply_objects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_broadcasts_status_idx" ON "chat_broadcasts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "chat_broadcasts_scheduled_at_idx" ON "chat_broadcasts" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "chat_intent_keywords_intent_id_idx" ON "chat_intent_keywords" USING btree ("intent_id");--> statement-breakpoint
CREATE INDEX "chat_intent_responses_intent_id_idx" ON "chat_intent_responses" USING btree ("intent_id");--> statement-breakpoint
CREATE INDEX "chat_intent_responses_reply_object_id_idx" ON "chat_intent_responses" USING btree ("reply_object_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_intents_name_idx" ON "chat_intents" USING btree ("name");--> statement-breakpoint
CREATE INDEX "chat_intents_is_active_idx" ON "chat_intents" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_reply_objects_object_id_idx" ON "chat_reply_objects" USING btree ("object_id");--> statement-breakpoint
CREATE INDEX "chat_reply_objects_is_active_idx" ON "chat_reply_objects" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "media_files_category_idx" ON "media_files" USING btree ("category");--> statement-breakpoint
CREATE INDEX "media_files_uploaded_by_idx" ON "media_files" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "rich_menus_status_idx" ON "rich_menus" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "rich_menus_line_rich_menu_id_idx" ON "rich_menus" USING btree ("line_rich_menu_id") WHERE line_rich_menu_id IS NOT NULL;