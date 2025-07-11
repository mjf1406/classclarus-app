// src/app/api/grade-scales/actions/updateGradeScale.ts
"use server";

import { db } from "@/server/db";
import { grade_scales } from "@/server/db/schema";
import type { Grade } from "@/server/db/types";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";

export type UpdateGradeScaleArgs = {
  id: string;
  name?: string;
  grades?: Grade[];
};

/** Returns the updated grade_scale.id */
export async function updateGradeScale(
  args: UpdateGradeScaleArgs,
): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  // 0) verify it exists & you own it
  const existing = await db
    .select({ user_id: grade_scales.user_id })
    .from(grade_scales)
    .where(and(eq(grade_scales.id, args.id), eq(grade_scales.user_id, userId)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existing) {
    throw new Error("Grade scale not found or not yours");
  }

  // 1) perform the update
  await db
    .update(grade_scales)
    .set({
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.grades !== undefined ? { grades: args.grades } : {}),
    })
    .where(eq(grade_scales.id, args.id));

  return args.id;
}
