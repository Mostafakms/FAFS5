import { defineAction, fail } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server/request-context";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "Permanently delete a project building and its linked progress and history.",
  schema: z.object({ buildingId: z.string().min(1) }),
  requiresAuth: true,
  run: async ({ buildingId }) => {
    const email = getRequestUserEmail();
    if (!email) fail("Authentication required", { statusCode: 401 });
    const db = getDb();
    const [user] = await db.select({ role: schema.projectUsers.role, active: schema.projectUsers.active })
      .from(schema.projectUsers).where(and(eq(schema.projectUsers.email, email), eq(schema.projectUsers.active, true))).limit(1);
    if (!user || user.role !== "Site Manager") fail("Only the Site Manager can manage buildings", { statusCode: 403 });

    await db.transaction(async (tx) => {
      const [building] = await tx.select({ id: schema.buildings.id }).from(schema.buildings).where(eq(schema.buildings.id, buildingId)).limit(1);
      if (!building) fail("Building not found", { statusCode: 404 });
      await tx.delete(schema.progressHistory).where(eq(schema.progressHistory.buildingId, buildingId));
      await tx.delete(schema.activityProgress).where(eq(schema.activityProgress.buildingId, buildingId));
      await tx.delete(schema.buildings).where(eq(schema.buildings.id, buildingId));
    });
    return { ok: true, buildingId };
  },
});
