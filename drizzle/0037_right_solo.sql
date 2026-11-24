CREATE TABLE "line_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"dedup_key" text NOT NULL,
	"event_type" text NOT NULL,
	"line_user_id_hash" text NOT NULL,
	"event_timestamp" integer NOT NULL,
	"reply_token" text,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"effects_committed_at" timestamp,
	"pending_replies" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_until" timestamp,
	CONSTRAINT "line_webhook_events_dedup_key_unique" UNIQUE("dedup_key"),
	CONSTRAINT "line_webhook_events_event_type_check" CHECK ("line_webhook_events"."event_type" IN ('message', 'follow', 'unfollow', 'postback')),
	CONSTRAINT "line_webhook_events_status_check" CHECK ("line_webhook_events"."status" IN ('pending', 'processing', 'done', 'failed'))
);
--> statement-breakpoint
CREATE INDEX "line_webhook_events_pending_by_user_idx" ON "line_webhook_events" USING btree ("line_user_id_hash","event_timestamp","id") WHERE status IN ('pending', 'processing');--> statement-breakpoint
CREATE INDEX "line_webhook_events_lease_idx" ON "line_webhook_events" USING btree ("lease_until","created_at") WHERE status = 'processing';