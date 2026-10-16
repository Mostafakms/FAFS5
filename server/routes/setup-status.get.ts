import { eq } from "drizzle-orm";
import { defineEventHandler } from "h3";

import { getDb, schema } from "../db.js";

export default defineEventHandler(async () => {
  const [manager] = await getDb()
    .select({ email: schema.projectUsers.email })
    .from(schema.projectUsers)
    .where(eq(schema.projectUsers.role, "Site Manager"))
    .limit(1);
  return { needsSetup: !manager };
});
