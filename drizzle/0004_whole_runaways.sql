CREATE TABLE "villages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "villages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sub_district_id" integer NOT NULL,
	"code" text NOT NULL,
	"name_th" text NOT NULL,
	"latitude" text,
	"longitude" text
);
--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "village_id" integer;--> statement-breakpoint
ALTER TABLE "villages" ADD CONSTRAINT "villages_sub_district_id_sub_districts_id_fk" FOREIGN KEY ("sub_district_id") REFERENCES "public"."sub_districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "villages_sub_district_id_idx" ON "villages" USING btree ("sub_district_id");--> statement-breakpoint
CREATE INDEX "villages_code_idx" ON "villages" USING btree ("code");--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_village_id_villages_id_fk" FOREIGN KEY ("village_id") REFERENCES "public"."villages"("id") ON DELETE no action ON UPDATE no action;