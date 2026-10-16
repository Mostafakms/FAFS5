CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"weight" numeric(6, 3) NOT NULL,
	"position" numeric(6, 0) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	CONSTRAINT "activities_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "activity_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"building_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"progress" numeric(5, 2) DEFAULT '0' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"updated_at" text DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'Project setup' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buildings" (
	"id" text PRIMARY KEY NOT NULL,
	"building_number" text NOT NULL,
	"name" text NOT NULL,
	"building_type" text NOT NULL,
	"relative_weight" numeric(10, 3) DEFAULT '1' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"geometry" jsonb,
	"created_at" text DEFAULT now() NOT NULL,
	"updated_at" text DEFAULT now() NOT NULL,
	CONSTRAINT "buildings_building_number_unique" UNIQUE("building_number")
);
--> statement-breakpoint
CREATE TABLE "progress_history" (
	"id" text PRIMARY KEY NOT NULL,
	"building_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"previous_progress" numeric(5, 2) NOT NULL,
	"new_progress" numeric(5, 2) NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"changed_at" text DEFAULT now() NOT NULL,
	"changed_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_users" (
	"email" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_progress" ADD CONSTRAINT "activity_progress_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_progress" ADD CONSTRAINT "activity_progress_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_history" ADD CONSTRAINT "progress_history_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_history" ADD CONSTRAINT "progress_history_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_progress_building_activity_unique" ON "activity_progress" USING btree ("building_id","activity_id");
--> statement-breakpoint
INSERT INTO "activities" ("id", "name", "weight", "position", "active") VALUES
('act-design', 'Shop Drawings, Datasheets, and Design Verification', 0, 1, true),
('act-first-fix', 'First Fix', 57, 2, true),
('act-cable', 'Cable Pulling', 20, 3, true),
('act-device', 'Device Installation', 9, 4, true),
('act-termination', 'Termination', 9, 5, true),
('act-testing', 'Programming, Testing and Commissioning', 4, 6, true),
('act-asbuilt', 'As-built', 0, 7, true),
('act-handover', 'Handover', 1, 8, true);
--> statement-breakpoint
INSERT INTO "buildings" ("id", "building_number", "name", "building_type", "relative_weight") VALUES
('bld-001', 'S-001', 'Sample Process Building', 'Process Building', 1),
('bld-002', 'S-002', 'Sample Substation', 'Substation', 1),
('bld-003', 'S-003', 'Sample Control Room', 'Control Room', 1),
('bld-004', 'S-004', 'Sample Warehouse', 'Warehouse', 1),
('bld-005', 'S-005', 'Sample Administration Building', 'Administration Building', 1),
('bld-006', 'S-006', 'Sample Out-of-Scope Facility', 'Removed from Scope', 1);
--> statement-breakpoint
INSERT INTO "activity_progress" ("id", "building_id", "activity_id", "progress", "updated_by") VALUES
('p-001-design', 'bld-001', 'act-design', 0, 'Project setup'), ('p-001-first', 'bld-001', 'act-first-fix', 40, 'Project setup'), ('p-001-cable', 'bld-001', 'act-cable', 12, 'Project setup'), ('p-001-device', 'bld-001', 'act-device', 0, 'Project setup'), ('p-001-term', 'bld-001', 'act-termination', 0, 'Project setup'), ('p-001-test', 'bld-001', 'act-testing', 0, 'Project setup'), ('p-001-asbuilt', 'bld-001', 'act-asbuilt', 0, 'Project setup'), ('p-001-handover', 'bld-001', 'act-handover', 0, 'Project setup'),
('p-002-design', 'bld-002', 'act-design', 0, 'Project setup'), ('p-002-first', 'bld-002', 'act-first-fix', 60, 'Project setup'), ('p-002-cable', 'bld-002', 'act-cable', 20, 'Project setup'), ('p-002-device', 'bld-002', 'act-device', 50, 'Project setup'), ('p-002-term', 'bld-002', 'act-termination', 30, 'Project setup'), ('p-002-test', 'bld-002', 'act-testing', 10, 'Project setup'), ('p-002-asbuilt', 'bld-002', 'act-asbuilt', 0, 'Project setup'), ('p-002-handover', 'bld-002', 'act-handover', 0, 'Project setup'),
('p-003-design', 'bld-003', 'act-design', 0, 'Project setup'), ('p-003-first', 'bld-003', 'act-first-fix', 80, 'Project setup'), ('p-003-cable', 'bld-003', 'act-cable', 50, 'Project setup'), ('p-003-device', 'bld-003', 'act-device', 80, 'Project setup'), ('p-003-term', 'bld-003', 'act-termination', 80, 'Project setup'), ('p-003-test', 'bld-003', 'act-testing', 35, 'Project setup'), ('p-003-asbuilt', 'bld-003', 'act-asbuilt', 0, 'Project setup'), ('p-003-handover', 'bld-003', 'act-handover', 0, 'Project setup'),
('p-004-design', 'bld-004', 'act-design', 0, 'Project setup'), ('p-004-first', 'bld-004', 'act-first-fix', 0, 'Project setup'), ('p-004-cable', 'bld-004', 'act-cable', 0, 'Project setup'), ('p-004-device', 'bld-004', 'act-device', 0, 'Project setup'), ('p-004-term', 'bld-004', 'act-termination', 0, 'Project setup'), ('p-004-test', 'bld-004', 'act-testing', 0, 'Project setup'), ('p-004-asbuilt', 'bld-004', 'act-asbuilt', 0, 'Project setup'), ('p-004-handover', 'bld-004', 'act-handover', 0, 'Project setup'),
('p-005-design', 'bld-005', 'act-design', 0, 'Project setup'), ('p-005-first', 'bld-005', 'act-first-fix', 100, 'Project setup'), ('p-005-cable', 'bld-005', 'act-cable', 100, 'Project setup'), ('p-005-device', 'bld-005', 'act-device', 100, 'Project setup'), ('p-005-term', 'bld-005', 'act-termination', 100, 'Project setup'), ('p-005-test', 'bld-005', 'act-testing', 100, 'Project setup'), ('p-005-asbuilt', 'bld-005', 'act-asbuilt', 0, 'Project setup'), ('p-005-handover', 'bld-005', 'act-handover', 100, 'Project setup'),
('p-006-design', 'bld-006', 'act-design', 0, 'Project setup'), ('p-006-first', 'bld-006', 'act-first-fix', 25, 'Project setup'), ('p-006-cable', 'bld-006', 'act-cable', 10, 'Project setup'), ('p-006-device', 'bld-006', 'act-device', 20, 'Project setup'), ('p-006-term', 'bld-006', 'act-termination', 0, 'Project setup'), ('p-006-test', 'bld-006', 'act-testing', 0, 'Project setup'), ('p-006-asbuilt', 'bld-006', 'act-asbuilt', 0, 'Project setup'), ('p-006-handover', 'bld-006', 'act-handover', 0, 'Project setup');
