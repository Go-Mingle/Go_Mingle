CREATE TABLE "interest_table_invitees" (
	"interest_table_id" text NOT NULL,
	"mingler_id" text NOT NULL,
	"seq" serial NOT NULL,
	"full_name" text NOT NULL,
	"is_promingler" boolean DEFAULT false NOT NULL,
	"date_invited" text NOT NULL,
	"status" text DEFAULT 'INVITED' NOT NULL,
	CONSTRAINT "interest_table_invitees_interest_table_id_mingler_id_pk" PRIMARY KEY("interest_table_id","mingler_id")
);
--> statement-breakpoint
CREATE TABLE "interest_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"restaurant_id" text NOT NULL,
	"name" text,
	"topic" jsonb,
	"assigned_table" jsonb,
	"seats_booked" integer DEFAULT 0 NOT NULL,
	"max_guests" integer,
	"start_date" text,
	"start_time" text,
	"duration_minutes" integer,
	"combo_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"invite_list" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"event_image_url" text,
	"availability_mode" text,
	"invite_only" boolean DEFAULT false NOT NULL,
	"promingler_enabled" boolean DEFAULT false NOT NULL,
	"promingler_mingler_id" text,
	"time_left" text NOT NULL,
	"status" text NOT NULL,
	"created" text NOT NULL
);
