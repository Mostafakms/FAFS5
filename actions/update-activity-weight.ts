import { defineAction, fail } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server/request-context";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "Update all activity progress weights.",
  schema: z.object({ weights: z.array(z.object({ activityId: z.string().min(1), weight: z.number().min(0).max(100) })).min(1) }),
  requiresAuth: true,
  run: async ({ weights }) => {
    const email = getRequestUserEmail();
    if (!email) fail("Authentication required", { statusCode: 401 });

    const db = getDb();
    const [user] = await db.select({ role: schema.projectUsers.role, active: schema.projectUsers.active })
      .from(schema.projectUsers)
      .where(and(eq(schema.projectUsers.email, email), eq(schema.projectUsers.active, true)))
      .limit(1);
    if (!user || user.role !== "Site Manager") {
      fail("Only the Site Manager can edit activity weights", { statusCode: 403 });
    }

    const uniqueIds = new Set(weights.map(({ activityId }) => activityId));
    if (uniqueIds.size !== weights.length) fail("Each activity can only appear once", { statusCode: 400 });
    const total = weights.reduce((sum, { weight }) => sum + weight, 0);
    if (Math.round(total * 10) !== 1000) fail("Activity weights must total 100%", { statusCode: 400 });

    await db.transaction(async (tx) => {
      const activities = await tx.select({ id: schema.activities.id })
        .from(schema.activities)
        .where(and(eq(schema.activities.active, true), inArray(schema.activities.id, [...uniqueIds])));
      if (activities.length !== weights.length) fail("The submitted activity list does not match active activities", { statusCode: 400 });
      await Promise.all(weights.map(({ activityId, weight }) => tx.update(schema.activities)
        .set({ weight: String(weight) })
        .where(eq(schema.activities.id, activityId))));
    });
    return { ok: true };
  },
});
