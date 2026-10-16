import { defineAction } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "Check whether the initial Site Manager account still needs setup.",
  schema: z.object({}),
  http: { method: "GET" },
  run: async () => {
    const [manager] = await getDb().select({ email: schema.projectUsers.email })
      .from(schema.projectUsers)
      .where(eq(schema.projectUsers.role, "Site Manager"))
      .limit(1);
    return { needsSetup: !manager };
  },
});
