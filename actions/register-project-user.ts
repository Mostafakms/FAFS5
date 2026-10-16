import { defineAction, fail } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server/request-context";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db.js";

export default defineAction({
  description:
    "Assign a newly created username to the Supervisor or Viewer project role.",
  schema: z.object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .regex(/^[a-zA-Z0-9._-]+$/),
    displayName: z.string().trim().min(1).max(100),
    role: z.enum(["Supervisor", "Viewer"]),
  }),
  requiresAuth: true,
  run: async ({ username, displayName, role }) => {
    const managerEmail = getRequestUserEmail();
    if (!managerEmail) fail("Authentication required", { statusCode: 401 });
    const db = getDb();
    const [manager] = await db
      .select({
        role: schema.projectUsers.role,
        active: schema.projectUsers.active,
      })
      .from(schema.projectUsers)
      .where(eq(schema.projectUsers.email, managerEmail))
      .limit(1);
    if (!manager?.active || manager.role !== "Site Manager")
      fail("Only the Site Manager can manage accounts", { statusCode: 403 });
    const email = `${username.toLowerCase()}@aprc.invalid`;
    const [existing] = await db
      .select({ email: schema.projectUsers.email })
      .from(schema.projectUsers)
      .where(eq(schema.projectUsers.email, email))
      .limit(1);
    if (existing) fail("That username already exists", { statusCode: 409 });
    const [user] = await db
      .insert(schema.projectUsers)
      .values({
        email,
        username: username.toLowerCase(),
        displayName,
        role,
        active: true,
      })
      .returning({
        username: schema.projectUsers.username,
        displayName: schema.projectUsers.displayName,
        role: schema.projectUsers.role,
        active: schema.projectUsers.active,
      });
    return { user };
  },
});
