import { defineAction, fail } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server/request-context";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "Create or update a project building.",
  schema: z.object({
    buildingId: z.string().min(1).optional(),
    buildingNumber: z.string().trim().min(1).max(60),
    name: z.string().trim().min(1).max(200),
    manualStatus: z.enum(["Removed from scope", "Hold", "Delayed"]).nullable(),
    statusReason: z.string().max(1000),
    relativeWeight: z.number().positive().max(1000000),
  }),
  requiresAuth: true,
  run: async ({ buildingId, buildingNumber, name, manualStatus, statusReason, relativeWeight }) => {
    if (["Hold", "Delayed"].includes(manualStatus ?? "") && !statusReason.trim()) fail("A reason is required for Hold and Delayed statuses", { statusCode: 400 });
    if (!["Hold", "Delayed"].includes(manualStatus ?? "") && statusReason.trim()) fail("A reason is only supported for Hold and Delayed statuses", { statusCode: 400 });
    const email = getRequestUserEmail();
    if (!email) fail("Authentication required", { statusCode: 401 });
    const db = getDb();
    const [user] = await db.select({ role: schema.projectUsers.role, active: schema.projectUsers.active })
      .from(schema.projectUsers).where(and(eq(schema.projectUsers.email, email), eq(schema.projectUsers.active, true))).limit(1);
    if (!user || user.role !== "Site Manager") fail("Only the Site Manager can manage buildings", { statusCode: 403 });

    try {
      if (buildingId) {
        const [building] = await db.update(schema.buildings)
          .set({ buildingNumber, name, manualStatus, statusReason: statusReason.trim(), relativeWeight: String(relativeWeight), updatedAt: new Date().toISOString() })
          .where(eq(schema.buildings.id, buildingId)).returning({ id: schema.buildings.id });
        if (!building) fail("Building not found", { statusCode: 404 });
        return { ok: true, buildingId };
      }
      const id = crypto.randomUUID();
      await db.insert(schema.buildings).values({ id, buildingNumber, name, buildingType: "Building", manualStatus, statusReason: statusReason.trim(), relativeWeight: String(relativeWeight) });
      const activities = await db.select({ id: schema.activities.id }).from(schema.activities).where(eq(schema.activities.active, true));
      if (activities.length) await db.insert(schema.activityProgress).values(activities.map((activity) => ({ id: crypto.randomUUID(), buildingId: id, activityId: activity.id, progress: "0", updatedBy: user.role })));
      return { ok: true, buildingId: id };
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "23505") fail("A building with that number already exists", { statusCode: 409 });
      throw error;
    }
  },
});
