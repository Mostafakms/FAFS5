import { defineAction, fail } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server/request-context";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "Deactivate a project user account.",
  schema: z.object({ username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9._-]+$/) }),
  requiresAuth: true,
  run: async ({ username }) => {
    const email = getRequestUserEmail();
    if (!email) fail("Authentication required", { statusCode: 401 });

    const db = getDb();
    return db.transaction(async (tx) => {
      const [manager] = await tx.select({ role: schema.projectUsers.role, active: schema.projectUsers.active })
        .from(schema.projectUsers)
        .where(eq(schema.projectUsers.email, email))
        .limit(1);
      if (!manager?.active || manager.role !== "Site Manager") {
        fail("Only the Site Manager can manage accounts", { statusCode: 403 });
      }

      const [target] = await tx.select({ email: schema.projectUsers.email, role: schema.projectUsers.role, active: schema.projectUsers.active })
        .from(schema.projectUsers)
        .where(eq(schema.projectUsers.username, username.toLowerCase()))
        .limit(1);
      if (!target) fail("User not found", { statusCode: 404 });
      if (target.email === email) fail("You cannot deactivate your own account", { statusCode: 400 });
      if (!target.active) return { ok: true, username: username.toLowerCase(), active: false };

      if (target.role === "Site Manager") {
        const activeManagers = await tx.select({ email: schema.projectUsers.email })
          .from(schema.projectUsers)
          .where(and(eq(schema.projectUsers.role, "Site Manager"), eq(schema.projectUsers.active, true)));
        if (activeManagers.length <= 1) fail("The last active Site Manager cannot be deactivated", { statusCode: 400 });
      }

      await tx.update(schema.projectUsers)
        .set({ active: false })
        .where(eq(schema.projectUsers.email, target.email));
      return { ok: true, username: username.toLowerCase(), active: false };
    });
  },
});
