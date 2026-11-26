CREATE TABLE IF NOT EXISTS "case_notifications" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "case_id" text NOT NULL REFERENCES "cases"("id") ON DELETE cascade,
  "tracking_code" text NOT NULL,
  "title" text NOT NULL,
  "category_name" text NOT NULL,
  "channel" text NOT NULL,
  "location" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  CONSTRAINT "case_notifications_case_uid" UNIQUE ("case_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "case_notifications_status_idx" ON "case_notifications" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_broadcast_batches" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "broadcast_id" text NOT NULL REFERENCES "chat_broadcasts"("id") ON DELETE cascade,
  "batch_index" integer NOT NULL,
  "recipient_ids" jsonb,
  "recipient_hashes" jsonb NOT NULL,
  "retry_key" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "next_attempt_at" timestamp,
  "last_error" text,
  CONSTRAINT "chat_broadcast_batches_broadcast_batch_uid" UNIQUE ("broadcast_id", "batch_index")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_broadcast_batches_broadcast_id_idx" ON "chat_broadcast_batches" ("broadcast_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_broadcast_batches_due_idx" ON "chat_broadcast_batches" ("status", "next_attempt_at");
