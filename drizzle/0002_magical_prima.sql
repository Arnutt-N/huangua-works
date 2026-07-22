CREATE TABLE "districts" (
	"id" integer PRIMARY KEY NOT NULL,
	"province_id" integer NOT NULL,
	"code" text NOT NULL,
	"district_code" text NOT NULL,
	"name_th" text NOT NULL,
	"name_en" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provinces" (
	"id" integer PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_th" text NOT NULL,
	"name_en" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sub_districts" (
	"id" integer PRIMARY KEY NOT NULL,
	"district_id" integer NOT NULL,
	"code" text NOT NULL,
	"sub_district_code" text NOT NULL,
	"name_th" text NOT NULL,
	"name_en" text NOT NULL,
	"postal_code" text,
	"latitude" text,
	"longitude" text
);
--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "province_id" integer;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "district_id" integer;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "sub_district_id" integer;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "village" text;--> statement-breakpoint
CREATE INDEX "districts_province_id_idx" ON "districts" USING btree ("province_id");--> statement-breakpoint
CREATE INDEX "districts_name_th_idx" ON "districts" USING btree ("name_th");--> statement-breakpoint
CREATE INDEX "provinces_name_th_idx" ON "provinces" USING btree ("name_th");--> statement-breakpoint
CREATE INDEX "sub_districts_district_id_idx" ON "sub_districts" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "sub_districts_name_th_idx" ON "sub_districts" USING btree ("name_th");--> statement-breakpoint
CREATE INDEX "cases_province_id_idx" ON "cases" USING btree ("province_id");--> statement-breakpoint
CREATE INDEX "cases_district_id_idx" ON "cases" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "cases_sub_district_id_idx" ON "cases" USING btree ("sub_district_id");