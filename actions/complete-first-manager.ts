import { defineAction, fail } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server/request-context";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db.js";

export default defineAction({
  description:
    "Finalize the one-time Site Manager setup for the authenticated first account.",
  schema: z.object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .regex(/^[a-zA-Z0-9._-]+$/),
    displayName: z.string().trim().min(1).max(100),
  }),
  requiresAuth: true,
  run: async ({ username, displayName }) => {
    const email = getRequestUserEmail();
    if (email !== `${username.toLowerCase()}@aprc.invalid`)
      fail("Only the first account can complete setup", { statusCode: 403 });
    const db = getDb();
    return db.transaction(async (tx) => {
      const [existingManager] = await tx
        .select({ email: schema.projectUsers.email })
        .from(schema.projectUsers)
        .where(eq(schema.projectUsers.role, "Site Manager"))
        .limit(1);
      if (existingManager)
        fail("Initial Site Manager setup has already been completed", {
          statusCode: 409,
        });
      const [user] = await tx
        .insert(schema.projectUsers)
        .values({
          email,
          username: username.toLowerCase(),
          displayName,
          role: "Site Manager",
          active: true,
        })
        .returning({
          email: schema.projectUsers.email,
          username: schema.projectUsers.username,
          role: schema.projectUsers.role,
        });
      return { user };
    });
  },
});
