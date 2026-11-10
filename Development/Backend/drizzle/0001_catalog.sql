CREATE TABLE "amenities" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"name" text NOT NULL,
	"icon_url" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bucket_objects" (
	"key" text PRIMARY KEY NOT NULL,
	"bytes" "bytea" NOT NULL,
	"content_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"name" text NOT NULL,
	"commission_rate" double precision,
	"interest_tables_per_month" integer,
	"created_at" text NOT NULL,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "interests" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"name" text NOT NULL,
	"group_name" text,
	"created_at" text NOT NULL,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "preference_options" (
	"id" text NOT NULL,
	"question_id" text NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"display_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preference_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"question" text NOT NULL,
	"type" text,
	"question_order" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"graphic_url" text,
	"interests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" text NOT NULL
);
