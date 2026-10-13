CREATE TABLE "rich_menu_aliases" (
	"id" text PRIMARY KEY NOT NULL,
	"alias_id" text NOT NULL,
	"rich_menu_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rich_menu_aliases_alias_id_unique" UNIQUE("alias_id")
);
--> statement-breakpoint
ALTER TABLE "rich_menu_aliases" ADD CONSTRAINT "rich_menu_aliases_rich_menu_id_rich_menus_id_fk" FOREIGN KEY ("rich_menu_id") REFERENCES "public"."rich_menus"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rich_menu_aliases_menu_idx" ON "rich_menu_aliases" USING btree ("rich_menu_id");