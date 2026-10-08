CREATE TYPE "public"."queue_booking_status" AS ENUM('booked', 'confirmed', 'done', 'cancelled');--> statement-breakpoint
CREATE TABLE "queue_bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"full_name" text NOT NULL,
	"phone_number" text NOT NULL,
	"service_type" text NOT NULL,
	"note" text,
	"booking_date" date NOT NULL,
	"slot" text NOT NULL,
	"status" "queue_booking_status" DEFAULT 'booked' NOT NULL,
	"admin_note" text
);
--> statement-breakpoint
CREATE INDEX "queue_bookings_booking_date_idx" ON "queue_bookings" USING btree ("booking_date");--> statement-breakpoint
CREATE INDEX "queue_bookings_status_idx" ON "queue_bookings" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "queue_bookings_date_slot_idx" ON "queue_bookings" USING btree ("booking_date","slot") WHERE status <> 'cancelled';