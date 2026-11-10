ALTER TABLE "payment_failures" ADD COLUMN "attempts" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_failures" ADD COLUMN "resolved_by" text;--> statement-breakpoint
ALTER TABLE "payment_failures" ADD COLUMN "resolution" text;--> statement-breakpoint
ALTER TABLE "payment_failures" ADD COLUMN "resolution_note" text;--> statement-breakpoint
ALTER TABLE "escrow_holds" DROP COLUMN "held_amount";