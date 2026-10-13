CREATE TABLE "case_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"case_id" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	CONSTRAINT "case_feedback_case_id_unique" UNIQUE("case_id")
);
--> statement-breakpoint
ALTER TABLE "case_feedback" ADD CONSTRAINT "case_feedback_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_feedback_case_id_idx" ON "case_feedback" USING btree ("case_id");