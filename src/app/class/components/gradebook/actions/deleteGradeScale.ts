"use server";

import { db } from "@/server/db";
import { grade_scales } from "@/server/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";

/**
 * Deletes one grade_scale by id, verifying ownership.
 */
export async function deleteGradeScale(scaleId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  // 0) verify it exists & you own it
  const exists = await db
    .select()
    .from(grade_scales)
    .where(and(eq(grade_scales.id, scaleId), eq(grade_scales.user_id, userId)))
    .limit(1)
    .then((rows) => rows.length > 0);

  if (!exists) {
    throw new Error("Grade scale not found or not yours");
  }

  // 1) delete the grade scale
  await db.delete(grade_scales).where(eq(grade_scales.id, scaleId));
}
