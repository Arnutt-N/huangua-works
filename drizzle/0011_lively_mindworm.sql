CREATE TABLE "chat_admin_prefs" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"admin_user_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"muted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_canned_responses" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"shortcut" text,
	"content" text NOT NULL,
	"created_by" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_conversation_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"conversation_id" text NOT NULL,
	"tag_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'accent' NOT NULL,
	CONSTRAINT "chat_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD COLUMN "admin_note" text;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD COLUMN "admin_note_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD COLUMN "admin_note_updated_by" text;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_admin_prefs_admin_conv_idx" ON "chat_admin_prefs" USING btree ("admin_user_id","conversation_id");--> statement-breakpoint
CREATE INDEX "chat_admin_prefs_conversation_id_idx" ON "chat_admin_prefs" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_canned_responses_shortcut_idx" ON "chat_canned_responses" USING btree ("shortcut") WHERE shortcut is not null;--> statement-breakpoint
CREATE INDEX "chat_canned_responses_is_active_idx" ON "chat_canned_responses" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_conversation_tags_conv_tag_idx" ON "chat_conversation_tags" USING btree ("conversation_id","tag_id");--> statement-breakpoint
CREATE INDEX "chat_conversation_tags_tag_id_idx" ON "chat_conversation_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_tags_name_idx" ON "chat_tags" USING btree ("name");