CREATE TABLE "admin_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"deep_link" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" text NOT NULL,
	"read_at" text,
	"read_by_user_id" text
);
--> statement-breakpoint
CREATE TABLE "partner_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"restaurant_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"deep_link" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" text NOT NULL,
	"read_at" text
);
--> statement-breakpoint
CREATE TABLE "restaurant_contacts" (
	"restaurant_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"email" text,
	"phone" text,
	"deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "restaurant_contacts_restaurant_id_id_pk" PRIMARY KEY("restaurant_id","id")
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"created_at" text NOT NULL,
	"name" text,
	"cuisine" text,
	"description" text,
	"area_district" text,
	"city" text,
	"full_address" text,
	"latitude" double precision,
	"longitude" double precision,
	"owner_name" text,
	"owner_email" text,
	"owner_phone" text,
	"restaurant_phone" text,
	"restaurant_email" text,
	"website" text,
	"house_rules" text,
	"dress_code" text,
	"serves_alcohol" boolean,
	"main_photo_key" text,
	"visible_on_app" boolean DEFAULT false NOT NULL,
	"amenity_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"suspended" boolean DEFAULT false NOT NULL,
	"rejections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"first_submitted_at" bigint,
	"submitted" text,
	"rejection_reason" text,
	"rejected_on" text,
	"joined" text,
	"category_id" text,
	"payout_account_id" text
);
