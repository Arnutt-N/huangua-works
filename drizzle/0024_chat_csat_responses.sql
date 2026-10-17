CREATE TABLE "public"."chat_csat_responses" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"conversation_id" text NOT NULL,
	"score" integer NOT NULL,
	CONSTRAINT "chat_csat_responses_conversation_id_unique" UNIQUE("conversation_id"),
	CONSTRAINT "chat_csat_responses_score_check" CHECK ("score" BETWEEN 1 AND 5),
	CONSTRAINT "chat_csat_responses_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE CASCADE
);
