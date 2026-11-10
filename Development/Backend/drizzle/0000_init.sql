CREATE TABLE "admin_users" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"full_name" text NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"role_id" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"last_active" text NOT NULL,
	"created_at" text NOT NULL,
	"initials" text NOT NULL,
	"password_hash" text,
	"failures" integer DEFAULT 0 NOT NULL,
	"locked_until" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "one_time_codes" (
	"key" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"audience" text NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reset_sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"audience" text NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"name" text NOT NULL,
	"full_access" boolean DEFAULT false NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "change_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"timestamp" text NOT NULL,
	"admin" text NOT NULL,
	"initials" text NOT NULL,
	"action" text NOT NULL,
	"data" text NOT NULL,
	"old_val" text,
	"new_val" text NOT NULL,
	"module" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_users" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"restaurant_id" text NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"designation" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"last_active_at" text,
	"created_at" text NOT NULL,
	"password_hash" text,
	"failures" integer DEFAULT 0 NOT NULL,
	"locked_until" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meta" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_email_live" ON "admin_users" USING btree ("email") WHERE "admin_users"."status" <> 'DELETED';--> statement-breakpoint
CREATE INDEX "refresh_tokens_user" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_users_email_live" ON "partner_users" USING btree ("email") WHERE "partner_users"."status" <> 'DELETED';