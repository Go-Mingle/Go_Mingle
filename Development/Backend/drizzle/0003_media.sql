CREATE TABLE "media_counters" (
	"restaurant_id" text PRIMARY KEY NOT NULL,
	"next_id" integer DEFAULT 0 NOT NULL,
	"gallery_reads" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_uploads" (
	"restaurant_id" text NOT NULL,
	"upload_ref" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"content_type" text NOT NULL,
	"received" boolean DEFAULT false NOT NULL,
	"size" bigint DEFAULT 0 NOT NULL,
	"bytes" "bytea",
	CONSTRAINT "media_uploads_restaurant_id_upload_ref_pk" PRIMARY KEY("restaurant_id","upload_ref")
);
--> statement-breakpoint
CREATE TABLE "restaurant_media" (
	"restaurant_id" text NOT NULL,
	"media_id" text NOT NULL,
	"kind" text NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" bigint NOT NULL,
	"uploaded_at" text NOT NULL,
	"sort_order" integer,
	"ready_after_reads" integer,
	"bytes" "bytea",
	CONSTRAINT "restaurant_media_restaurant_id_media_id_pk" PRIMARY KEY("restaurant_id","media_id")
);
