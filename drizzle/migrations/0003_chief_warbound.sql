CREATE TABLE "site_maps" (
	"id" text PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"data_base64" text NOT NULL,
	"updated_at" text DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN "map_x" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN "map_y" numeric(7, 4);