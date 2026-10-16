import { defineAction, fail } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server/request-context";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db.js";

const pointSchema = z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) });

export default defineAction({
  description: "Save or clear a building's polygon on the uploaded site map.",
  schema: z.object({ buildingId: z.string().min(1), points: z.array(pointSchema).min(3).max(500).nullable() }),
  requiresAuth: true,
  run: async ({ buildingId, points }) => {
    const email = getRequestUserEmail();
    if (!email) fail("Authentication required", { statusCode: 401 });

    const db = getDb();
    const [user] = await db.select({ role: schema.projectUsers.role, active: schema.projectUsers.active })
      .from(schema.projectUsers)
      .where(eq(schema.projectUsers.email, email))
      .limit(1);
    if (!user?.active || user.role !== "Site Manager") {
      fail("Only the Site Manager can edit building map polygons", { statusCode: 403 });
    }

    const [siteMap] = await db.select({ id: schema.siteMaps.id }).from(schema.siteMaps).where(eq(schema.siteMaps.id, "primary")).limit(1);
    if (!siteMap) fail("Upload a site map before drawing building polygons", { statusCode: 400 });

    const [building] = await db.update(schema.buildings)
      .set({ geometry: points ? { points } : null, updatedAt: new Date().toISOString() })
      .where(eq(schema.buildings.id, buildingId))
      .returning({ id: schema.buildings.id });
    if (!building) fail("Building not found", { statusCode: 404 });
    return { ok: true, buildingId, points };
  },
});
