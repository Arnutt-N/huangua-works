CREATE TABLE "public"."line_friend_events" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"line_user_id" text NOT NULL,
	"event" text NOT NULL,
	"webhook_event_id" text NOT NULL,
	CONSTRAINT "line_friend_events_event_check" CHECK ("event" IN ('follow', 'unfollow')),
	CONSTRAINT "line_friend_events_line_user_id_line_users_id_fk" FOREIGN KEY ("line_user_id") REFERENCES "public"."line_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);--> statement-breakpoint
CREATE UNIQUE INDEX "line_friend_events_webhook_event_id_idx" ON "public"."line_friend_events" USING btree ("webhook_event_id");--> statement-breakpoint
CREATE INDEX "line_friend_events_line_user_id_idx" ON "public"."line_friend_events" USING btree ("line_user_id");--> statement-breakpoint
CREATE TABLE "public"."chat_broadcast_failed_recipients" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"broadcast_id" text NOT NULL,
	"recipient_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	CONSTRAINT "chat_broadcast_failed_recipients_broadcast_recipient_uid" UNIQUE("broadcast_id", "recipient_hash"),
	CONSTRAINT "chat_broadcast_failed_recipients_broadcast_id_chat_broadcasts_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."chat_broadcasts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);--> statement-breakpoint
CREATE INDEX "chat_broadcast_failed_recipients_broadcast_id_idx" ON "public"."chat_broadcast_failed_recipients" USING btree ("broadcast_id");--> statement-breakpoint
ALTER TABLE "public"."chat_broadcasts" ALTER COLUMN "target" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."chat_broadcasts" ALTER COLUMN "target" SET DATA TYPE jsonb USING (CASE WHEN "target" = 'all' THEN '{"kind":"all"}'::jsonb ELSE '{"kind":"all"}'::jsonb END);--> statement-breakpoint
ALTER TABLE "public"."chat_broadcasts" ALTER COLUMN "target" SET DEFAULT '{"kind":"all"}'::jsonb;--> statement-breakpoint
ALTER TABLE "public"."chat_broadcasts" ALTER COLUMN "target" SET NOT NULL;
