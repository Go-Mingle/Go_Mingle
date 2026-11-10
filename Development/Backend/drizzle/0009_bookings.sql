CREATE TABLE "payment_failures" (
	"seq" serial PRIMARY KEY NOT NULL,
	"hold_id" text,
	"booking_id" text,
	"action" text NOT NULL,
	"amount" double precision,
	"message" text NOT NULL,
	"at" text NOT NULL,
	"resolved_at" text
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"booking_ref" text NOT NULL,
	"interest_table_id" text NOT NULL,
	"restaurant_id" text NOT NULL,
	"mingler_id" text,
	"mingler_name" text NOT NULL,
	"seats" integer NOT NULL,
	"menu_option" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"attendance" text,
	"arrived_seats" integer,
	"empty_seats" integer,
	"penalty_per_seat_pkr" double precision NOT NULL,
	"cancellation_window_hours" integer NOT NULL,
	"penalty_charged_pkr" double precision,
	"penalty_status" text,
	"escrow_hold_id" text,
	"checked_in_by" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "no_show_penalty_per_seat_pkr" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "cancellation_window_hours" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "escrow_holds" ADD COLUMN "kind" text DEFAULT 'PAYMENT' NOT NULL;--> statement-breakpoint
ALTER TABLE "escrow_holds" ADD COLUMN "booking_id" text;--> statement-breakpoint
ALTER TABLE "escrow_holds" ADD COLUMN "held_amount" double precision;--> statement-breakpoint
ALTER TABLE "escrow_holds" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_idempotency_key_unique" UNIQUE("idempotency_key");