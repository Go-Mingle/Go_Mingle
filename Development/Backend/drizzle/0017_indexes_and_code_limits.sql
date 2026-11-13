ALTER TABLE "one_time_codes" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "preference_options_question" ON "preference_options" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "partner_notifications_restaurant_created" ON "partner_notifications" USING btree ("restaurant_id","created_at");--> statement-breakpoint
CREATE INDEX "restaurants_status" ON "restaurants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "interest_tables_restaurant" ON "interest_tables" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_restaurant" ON "webhook_deliveries" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "escrow_holds_booking" ON "escrow_holds" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "escrow_holds_restaurant" ON "escrow_holds" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "escrow_holds_status" ON "escrow_holds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_failures_booking" ON "payment_failures" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "bookings_interest_table" ON "bookings" USING btree ("interest_table_id");--> statement-breakpoint
CREATE INDEX "bookings_restaurant" ON "bookings" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "bookings_status" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_ref" ON "bookings" USING btree ("booking_ref");