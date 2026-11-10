CREATE TABLE "menu_options" (
	"restaurant_id" text NOT NULL,
	"combo_id" text NOT NULL,
	"seq" serial NOT NULL,
	"name" text NOT NULL,
	"price_pkr" double precision NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"courses" jsonb NOT NULL,
	CONSTRAINT "menu_options_restaurant_id_combo_id_pk" PRIMARY KEY("restaurant_id","combo_id")
);
--> statement-breakpoint
CREATE TABLE "menu_pdfs" (
	"restaurant_id" text NOT NULL,
	"file" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	CONSTRAINT "menu_pdfs_restaurant_id_file_pk" PRIMARY KEY("restaurant_id","file")
);
--> statement-breakpoint
CREATE TABLE "restaurant_counters" (
	"restaurant_id" text NOT NULL,
	"name" text NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "restaurant_counters_restaurant_id_name_pk" PRIMARY KEY("restaurant_id","name")
);
--> statement-breakpoint
CREATE TABLE "restaurant_tables" (
	"restaurant_id" text NOT NULL,
	"table_id" text NOT NULL,
	"seq" serial NOT NULL,
	"name" text NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"availability" jsonb NOT NULL,
	CONSTRAINT "restaurant_tables_restaurant_id_table_id_pk" PRIMARY KEY("restaurant_id","table_id")
);
--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "menu_pdf_file" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "menu_pdf_name" text;