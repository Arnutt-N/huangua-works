CREATE TABLE "public"."chat_csat_responses" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"conversation_id" text NOT NULL,
	"score" integer NOT NULL,
	CONSTRAINT "chat_csat_responses_conversation_id_unique" UNIQUE("conversation_id")
);--> statement-breakpoint
CREATE UNIQUE INDEX "chat_csat_responses_conversation_id_idx" ON "public"."chat_csat_responses" USING btree ("conversation_id");
