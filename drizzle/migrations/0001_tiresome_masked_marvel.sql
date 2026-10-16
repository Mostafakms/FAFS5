ALTER TABLE "project_users" ADD COLUMN "username" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "one_site_manager" ON "project_users" USING btree ("role") WHERE "project_users"."role" = 'Site Manager';--> statement-breakpoint
ALTER TABLE "project_users" ADD CONSTRAINT "project_users_username_unique" UNIQUE("username");