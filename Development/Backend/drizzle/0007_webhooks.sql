CREATE TABLE "webhook_configs" (
	"restaurant_id" text PRIMARY KEY NOT NULL,
	"endpoint_url" text,
	"bearer_token" text,
	"signing_secret" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"secret_rotated_at" text
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"seq" serial PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"event_type" text NOT NULL,
	"tries" integer DEFAULT 1 NOT NULL,
	"reason" text,
	"occurred_at" text NOT NULL,
	"status" text NOT NULL,
	"is_test" boolean DEFAULT false NOT NULL,
	"visible_from" bigint DEFAULT 0 NOT NULL
);
