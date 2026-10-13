CREATE TABLE "case_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"case_id" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	CONSTRAINT "case_feedback_case_id_unique" UNIQUE("case_id")
);
--> statement-breakpoint
CREATE TABLE "rich_menu_aliases" (
	"id" text PRIMARY KEY NOT NULL,
	"alias_id" text NOT NULL,
	"rich_menu_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rich_menu_aliases_alias_id_unique" UNIQUE("alias_id")
);
--> statement-breakpoint
CREATE TABLE "tier_roles" (
	"tier" text PRIMARY KEY NOT NULL,
	"roles" text[] NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rich_menus" ADD COLUMN "display_start_at" timestamp;--> statement-breakpoint
ALTER TABLE "rich_menus" ADD COLUMN "display_end_at" timestamp;--> statement-breakpoint
ALTER TABLE "case_feedback" ADD CONSTRAINT "case_feedback_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rich_menu_aliases" ADD CONSTRAINT "rich_menu_aliases_rich_menu_id_rich_menus_id_fk" FOREIGN KEY ("rich_menu_id") REFERENCES "public"."rich_menus"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_feedback_case_id_idx" ON "case_feedback" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "rich_menu_aliases_menu_idx" ON "rich_menu_aliases" USING btree ("rich_menu_id");