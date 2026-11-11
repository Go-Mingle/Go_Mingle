ALTER TABLE "escrow_holds" ADD COLUMN "checkout" jsonb;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "seat_price_pkr" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "bill_pkr" double precision;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "bill_hold_id" text;