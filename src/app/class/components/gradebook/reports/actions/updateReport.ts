// src/app/class/components/reports/actions/updateReport.ts
"use server";

import { and, eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db/index";
import { reports } from "@/server/db/schema";

export type UpdateReportArgs = {
  id: string;
  class_id: string;
  name?: string;
  graded_subjects?: string[];
};

export async function updateReport(args: UpdateReportArgs): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  // 0) verify it exists & you own it
  const existing = await db
    .select({
      user_id: reports.user_id,
      class_id: reports.class_id,
    })
    .from(reports)
    .where(and(eq(reports.id, args.id), eq(reports.user_id, userId)))
    .limit(1)
    .then((rows) => rows[0]);
  if (!existing) throw new Error("Report not found or not yours");

  // 1) update fields if provided
  const toUpdate: Partial<{
    name: string;
    graded_subjects: string[];
  }> = {};
  if (args.name !== undefined) toUpdate.name = args.name;
  if (args.graded_subjects !== undefined)
    toUpdate.graded_subjects = args.graded_subjects;

  if (Object.keys(toUpdate).length > 0) {
    await db.update(reports).set(toUpdate).where(eq(reports.id, args.id));
  }

  return args.id;
}
