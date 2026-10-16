import { defineAction } from "@agent-native/core/action";
import { fail } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server/request-context";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "Read APRC buildings, weighted progress, activity summaries, and recent history.",
  schema: z.object({}),
  http: { method: "GET" },
  requiresAuth: true,
  run: async () => {
    const email = getRequestUserEmail();
    if (!email) fail("Authentication required", { statusCode: 401 });
    const db = getDb();
    const [user] = await db.select({ role: schema.projectUsers.role, active: schema.projectUsers.active })
      .from(schema.projectUsers)
      .where(eq(schema.projectUsers.email, email))
      .limit(1);
    if (!user?.active) fail("Your project account is inactive", { statusCode: 403 });
    const [buildings, activities, progress, history, siteMaps] = await Promise.all([
      db.select().from(schema.buildings).orderBy(asc(schema.buildings.buildingNumber)),
      db.select().from(schema.activities).where(eq(schema.activities.active, true)).orderBy(asc(schema.activities.position)),
      db.select().from(schema.activityProgress),
      db.select().from(schema.progressHistory).orderBy(desc(schema.progressHistory.changedAt)).limit(8),
      db.select({ filename: schema.siteMaps.filename, contentType: schema.siteMaps.contentType, updatedAt: schema.siteMaps.updatedAt })
        .from(schema.siteMaps).where(eq(schema.siteMaps.id, "primary")).limit(1),
    ]);
    const progressByBuilding = new Map<string, typeof progress>();
    for (const row of progress) {
      const rows = progressByBuilding.get(row.buildingId) ?? [];
      rows.push(row);
      progressByBuilding.set(row.buildingId, rows);
    }
    const summarized = buildings.map((building) => {
      const values = progressByBuilding.get(building.id) ?? [];
      const activityRows = activities.map((activity) => {
        const entry = values.find((row) => row.activityId === activity.id);
        const amount = Number(entry?.progress ?? 0);
        const weight = Number(activity.weight);
        return { ...activity, progress: amount, contribution: amount * weight / 100, updatedAt: entry?.updatedAt ?? null, updatedBy: entry?.updatedBy ?? null };
      });
      const manualStatus = building.manualStatus ?? (building.buildingType === "Removed from Scope" ? "Removed from scope" : null);
      return { ...building, manualStatus, statusReason: building.statusReason ?? "", progress: activityRows.reduce((sum, activity) => sum + activity.contribution, 0), activities: activityRows };
    });
    const activeBuildings = summarized.filter((building) => building.manualStatus !== "Removed from scope");
    const totalWeight = activeBuildings.reduce((sum, building) => sum + Number(building.relativeWeight), 0);
    const overall = totalWeight === 0 ? 0 : activeBuildings.reduce((sum, building) => sum + building.progress * Number(building.relativeWeight), 0) / totalWeight;
    const latest = history.map((item) => ({
      ...item,
      buildingNumber: summarized.find((building) => building.id === item.buildingId)?.buildingNumber ?? "—",
      buildingName: summarized.find((building) => building.id === item.buildingId)?.name ?? "Unknown building",
      activityName: activities.find((activity) => activity.id === item.activityId)?.name ?? "Activity",
    }));
    return {
      overall,
      userRole: user.role,
      siteMap: siteMaps[0] ?? null,
      buildings: summarized,
      activeCount: activeBuildings.length,
      removedCount: summarized.filter((building) => building.manualStatus === "Removed from scope").length,
      holdCount: summarized.filter((building) => building.manualStatus === "Hold").length,
      delayedCount: summarized.filter((building) => building.manualStatus === "Delayed").length,
      completedCount: activeBuildings.filter((building) => building.progress >= 99.99 && !building.manualStatus).length,
      inProgressCount: activeBuildings.filter((building) => !building.manualStatus && building.progress > 0 && building.progress < 99.99).length,
      notStartedCount: activeBuildings.filter((building) => !building.manualStatus && building.progress === 0).length,
      activities: activities.map((activity) => {
        const contributing = activeBuildings.reduce((sum, building) => sum + (building.activities.find((entry) => entry.id === activity.id)?.progress ?? 0), 0);
        return { ...activity, progress: activeBuildings.length ? contributing / activeBuildings.length : 0 };
      }),
      history: latest,
    };
  },
});
