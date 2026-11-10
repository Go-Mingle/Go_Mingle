CREATE TABLE "payout_accounts" (
	"restaurant_id" text PRIMARY KEY NOT NULL,
	"account_title" text NOT NULL,
	"bank_name" text NOT NULL,
	"iban" text NOT NULL,
	"added_at" text NOT NULL,
	"updated_at" text NOT NULL
);
