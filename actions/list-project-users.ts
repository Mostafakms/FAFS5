import { defineAction, fail } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server/request-context";
import { asc, and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "List project usernames and roles for the Site Manager.",
  schema: z.object({}),
  http: { method: "GET" },
  requiresAuth: true,
  run: async () => {
    const email = getRequestUserEmail();
    if (!email) fail("Authentication required", { statusCode: 401 });
    const db = getDb();
    const [manager] = await db.select({ role: schema.projectUsers.role, active: schema.projectUsers.active })
      .from(schema.projectUsers)
      .where(eq(schema.projectUsers.email, email))
      .limit(1);
    if (!manager?.active || manager.role !== "Site Manager") fail("Only the Site Manager can manage accounts", { statusCode: 403 });
    return db.select({ username: schema.projectUsers.username, displayName: schema.projectUsers.displayName, role: schema.projectUsers.role, active: schema.projectUsers.active, createdAt: schema.projectUsers.createdAt })
      .from(schema.projectUsers)
      .orderBy(asc(schema.projectUsers.username));
  },
});
