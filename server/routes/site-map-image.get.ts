import { getSession } from "@agent-native/core/server";
import { and, eq } from "drizzle-orm";
import { createError, defineEventHandler, setResponseHeader } from "h3";

import { getDb, schema } from "../db.js";

export default defineEventHandler(async (event) => {
  const session = await getSession(event);
  if (!session?.email) throw createError({ statusCode: 401, statusMessage: "Authentication required" });

  const db = getDb();
  const [user] = await db.select({ active: schema.projectUsers.active })
    .from(schema.projectUsers)
    .where(and(eq(schema.projectUsers.email, session.email), eq(schema.projectUsers.active, true)))
    .limit(1);
  if (!user) throw createError({ statusCode: 403, statusMessage: "Your project account is inactive" });

  const [siteMap] = await db.select({ contentType: schema.siteMaps.contentType, dataBase64: schema.siteMaps.dataBase64 })
    .from(schema.siteMaps)
    .where(eq(schema.siteMaps.id, "primary"))
    .limit(1);
  if (!siteMap) throw createError({ statusCode: 404, statusMessage: "No site map has been uploaded" });

  setResponseHeader(event, "content-type", siteMap.contentType);
  setResponseHeader(event, "cache-control", "private, no-store");
  setResponseHeader(event, "x-content-type-options", "nosniff");
  return Buffer.from(siteMap.dataBase64, "base64");
});
