// src/app/class/components/reports/actions/createReport.ts
"use server";

import { randomUUID } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db/index";
import { reports } from "@/server/db/schema";

export type CreateReportArgs = {
  class_id: string;
  name: string;
  graded_subjects?: string[];
};

export async function createReport(args: CreateReportArgs): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("User ID is null");

  const id = randomUUID();
  await db.insert(reports).values({
    id,
    user_id: userId,
    class_id: args.class_id,
    name: args.name,
    graded_subjects: args.graded_subjects ?? [],
  });

  return id;
}
