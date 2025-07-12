// src/app/class/components/reports/actions/deleteReport.ts
"use server";

import { and, eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db/index";
import { reports } from "@/server/db/schema";

export async function deleteReport(reportId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  // ensure it exists & is yours
  const exists = await db
    .select()
    .from(reports)
    .where(and(eq(reports.id, reportId), eq(reports.user_id, userId)))
    .limit(1)
    .then((rows) => rows.length > 0);

  if (!exists) throw new Error("Report not found or not yours");

  await db.delete(reports).where(eq(reports.id, reportId));
}
