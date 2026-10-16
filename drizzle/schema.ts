import { sql } from "drizzle-orm";
import {
  boolean,
  jsonb,
  numeric,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const buildings = pgTable("buildings", {
  id: text("id").primaryKey(),
  buildingNumber: text("building_number").notNull().unique(),
  name: text("name").notNull(),
  buildingType: text("building_type").notNull().default("Building"),
  manualStatus: text("manual_status"),
  statusReason: text("status_reason").notNull().default(""),
  relativeWeight: numeric("relative_weight", { precision: 10, scale: 3 })
    .notNull()
    .default("1"),
  notes: text("notes").notNull().default(""),
  geometry: jsonb("geometry"),
  mapX: numeric("map_x", { precision: 7, scale: 4 }),
  mapY: numeric("map_y", { precision: 7, scale: 4 }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`now()`),
});

export const activities = pgTable("activities", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  weight: numeric("weight", { precision: 6, scale: 3 }).notNull(),
  position: numeric("position", { precision: 6, scale: 0 }).notNull(),
  active: boolean("active").notNull().default(true),
  description: text("description").notNull().default(""),
});

export const activityProgress = pgTable(
  "activity_progress",
  {
    id: text("id").primaryKey(),
    buildingId: text("building_id")
      .notNull()
      .references(() => buildings.id),
    activityId: text("activity_id")
      .notNull()
      .references(() => activities.id),
    progress: numeric("progress", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    note: text("note").notNull().default(""),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`now()`),
    updatedBy: text("updated_by").notNull().default("Project setup"),
  },
  (table) => [
    uniqueIndex("activity_progress_building_activity_unique").on(
      table.buildingId,
      table.activityId,
    ),
  ],
);

export const progressHistory = pgTable("progress_history", {
  id: text("id").primaryKey(),
  buildingId: text("building_id")
    .notNull()
    .references(() => buildings.id),
  activityId: text("activity_id")
    .notNull()
    .references(() => activities.id),
  previousProgress: numeric("previous_progress", {
    precision: 5,
    scale: 2,
  }).notNull(),
  newProgress: numeric("new_progress", { precision: 5, scale: 2 }).notNull(),
  note: text("note").notNull().default(""),
  changedAt: text("changed_at")
    .notNull()
    .default(sql`now()`),
  changedBy: text("changed_by").notNull(),
});

export const siteMaps = pgTable("site_maps", {
  id: text("id").primaryKey(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  dataBase64: text("data_base64").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`now()`),
});

export const projectUsers = pgTable(
  "project_users",
  {
    email: text("email").primaryKey(),
    username: text("username").notNull().unique(),
    displayName: text("display_name").notNull(),
    role: text("role", {
      enum: ["Site Manager", "Supervisor", "Viewer"],
    }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("one_site_manager")
      .on(table.role)
      .where(sql`${table.role} = 'Site Manager'`),
  ],
);
