// src\app\class\components\gradebook\graded-assignments\actions\deleteGradedAssignment.ts
"use server";

import { db } from "@/server/db/index";
import {
  graded_assignments,
  assignment_sections,
  assignment_scores,
} from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

export async function deleteGradedAssignment(
  assignmentId: string,
): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  // ensure it exists & is yours
  const exists = await db
    .select()
    .from(graded_assignments)
    .where(
      and(
        eq(graded_assignments.id, assignmentId),
        eq(graded_assignments.user_id, userId),
      ),
    )
    .limit(1)
    .then((rows) => rows.length > 0);

  if (!exists) {
    throw new Error("Assignment not found or not yours");
  }

  await db.transaction(async (tx) => {
    // 1) delete all scores for this graded assignment
    await tx
      .delete(assignment_scores)
      .where(eq(assignment_scores.graded_assignment_id, assignmentId));

    // 2) delete all sections for this graded assignment
    await tx
      .delete(assignment_sections)
      .where(eq(assignment_sections.graded_assignment_id, assignmentId));

    // 3) delete the graded assignment itself
    await tx
      .delete(graded_assignments)
      .where(eq(graded_assignments.id, assignmentId));
  });
}
