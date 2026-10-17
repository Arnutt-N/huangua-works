ALTER TABLE "public"."chat_csat_responses" DROP CONSTRAINT "chat_csat_responses_conversation_id_unique";--> statement-breakpoint
ALTER TABLE "public"."chat_csat_responses" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "public"."chat_csat_responses" ADD CONSTRAINT "chat_csat_responses_cycle_uid" UNIQUE("conversation_id", "resolved_at");
