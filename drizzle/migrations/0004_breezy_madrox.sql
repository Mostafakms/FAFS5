ALTER TABLE "buildings" ALTER COLUMN "building_type" SET DEFAULT 'Building';--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN "manual_status" text;--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN "status_reason" text DEFAULT '' NOT NULL;