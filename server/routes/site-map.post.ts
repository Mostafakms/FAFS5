import { getSession } from "@agent-native/core/server";
import { eq } from "drizzle-orm";
import { assertBodySize, createError, defineEventHandler } from "h3";

import { getDb, schema } from "../db.js";

const maxMapBytes = 16 * 1024 * 1024;
const multipartOverheadBytes = 256 * 1024;

function detectImageType(data: Uint8Array) {
  if (data.length >= 8 && data.subarray(0, 8).join(",") === "137,80,78,71,13,10,26,10") return "image/png";
  if (data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return "image/jpeg";
  if (data.length >= 12 && Buffer.from(data.subarray(0, 4)).toString() === "RIFF" && Buffer.from(data.subarray(8, 12)).toString() === "WEBP") return "image/webp";
  return null;
}

export default defineEventHandler(async (event) => {
  assertBodySize(event, maxMapBytes + multipartOverheadBytes);
  const session = await getSession(event);
  if (!session?.email) throw createError({ statusCode: 401, statusMessage: "Authentication required" });

  const db = getDb();
  const [user] = await db.select({ role: schema.projectUsers.role, active: schema.projectUsers.active })
    .from(schema.projectUsers)
    .where(eq(schema.projectUsers.email, session.email))
    .limit(1);
  if (!user?.active || user.role !== "Site Manager") {
    throw createError({ statusCode: 403, statusMessage: "Only the Site Manager can upload a site map" });
  }

  const request = event.req;
  const formRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  const mapFile = (await formRequest.formData()).get("map");
  if (!(mapFile instanceof File)) throw createError({ statusCode: 400, statusMessage: "Choose a PNG, JPEG, or WebP image" });
  if (mapFile.size > maxMapBytes) {
    throw createError({ statusCode: 413, statusMessage: "The site map must be 16 MB or smaller" });
  }
  const fileData = new Uint8Array(await mapFile.arrayBuffer());
  const contentType = detectImageType(fileData);
  if (!contentType) {
    throw createError({ statusCode: 415, statusMessage: "Only PNG, JPEG, and WebP images are supported" });
  }

  const filename = mapFile.name.replace(/[\\/\0]/g, "_").slice(0, 255);
  const dataBase64 = Buffer.from(fileData).toString("base64");
  const updatedAt = new Date().toISOString();
  const saved = await db.transaction(async (tx) => {
    await tx.update(schema.buildings).set({ mapX: null, mapY: null });
    const [siteMap] = await tx.insert(schema.siteMaps).values({
      id: "primary",
      filename,
      contentType,
      dataBase64,
      updatedAt,
    }).onConflictDoUpdate({
      target: schema.siteMaps.id,
      set: { filename, contentType, dataBase64, updatedAt },
    }).returning({ filename: schema.siteMaps.filename, contentType: schema.siteMaps.contentType, updatedAt: schema.siteMaps.updatedAt });
    return siteMap;
  });

  return { siteMap: saved };
});
