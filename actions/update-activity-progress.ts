import { defineAction, fail } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server/request-context";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "Update one building activity progress value and record its history.",
  schema: z.object({
    buildingId: z.string().min(1),
    activityId: z.string().min(1),
    progress: z.number().min(0).max(100),
    note: z.string().max(1000).optional(),
  }),
  requiresAuth: true,
  run: async ({ buildingId, activityId, progress, note }) => {
    const email = getRequestUserEmail();
    if (!email) fail("Authentication required", { statusCode: 401 });
    const db = getDb();
    return db.transaction(async (tx) => {
      const [user] = await tx.select().from(schema.projectUsers).where(and(eq(schema.projectUsers.email, email), eq(schema.projectUsers.active, true))).limit(1);
      if (!user || (user.role !== "Site Manager" && user.role !== "Supervisor")) {
        fail("You do not have permission to update progress", { statusCode: 403 });
      }
      const [building] = await tx.select().from(schema.buildings).where(eq(schema.buildings.id, buildingId)).limit(1);
      const [activity] = await tx.select().from(schema.activities).where(and(eq(schema.activities.id, activityId), eq(schema.activities.active, true))).limit(1);
      if (!building || !activity) fail("Building or active activity not found", { statusCode: 404 });
      const [previous] = await tx.select().from(schema.activityProgress).where(and(eq(schema.activityProgress.buildingId, buildingId), eq(schema.activityProgress.activityId, activityId))).limit(1);
      const now = new Date().toISOString();
      const previousProgress = Number(previous?.progress ?? 0);
      const nextProgress = String(progress);
      await tx.insert(schema.activityProgress).values({
        id: previous?.id ?? crypto.randomUUID(),
        buildingId,
        activityId,
        progress: nextProgress,
        note: note?.trim() ?? "",
        updatedAt: now,
        updatedBy: user.displayName,
      }).onConflictDoUpdate({
        target: [schema.activityProgress.buildingId, schema.activityProgress.activityId],
        set: { progress: nextProgress, note: note?.trim() ?? "", updatedAt: now, updatedBy: user.displayName },
      });
      await tx.insert(schema.progressHistory).values({
        id: crypto.randomUUID(),
        buildingId,
        activityId,
        previousProgress: String(previousProgress),
        newProgress: nextProgress,
        note: note?.trim() ?? "",
        changedAt: now,
        changedBy: user.displayName,
      });
      return { ok: true, previousProgress, progress };
    });
  },
});
