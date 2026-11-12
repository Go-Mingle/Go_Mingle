CREATE TABLE "email_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_key" text NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"status" text NOT NULL,
	"provider" text NOT NULL,
	"provider_message_id" text,
	"error" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"key" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"heading" text NOT NULL,
	"body" text NOT NULL,
	"button_label" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" text,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "partner_users" ADD COLUMN "google_sub" text;--> statement-breakpoint
CREATE INDEX "email_log_created" ON "email_log" USING btree ("created_at");