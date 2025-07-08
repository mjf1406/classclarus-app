// app/_actions/gradedAssignment.ts
"use server";

import { db } from "@/server/db/index";
import { graded_assignments, assignment_sections } from "@/server/db/schema";
import type { SectionInput } from "./createGradedAssignment";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { formatDateTime } from "@/lib/utils";

export type UpdateGradedAssignmentArgs = {
  id: string;
  class_id: string;
  name?: string;
  total_points?: number | null;
  sections: SectionInput[];
};

export async function updateGradedAssignment(
  args: UpdateGradedAssignmentArgs,
): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  // 0) fetch to ensure it exists & you own it
  const existing = await db
    .select({ class_id: graded_assignments.class_id })
    .from(graded_assignments)
    .where(
      and(
        eq(graded_assignments.id, args.id),
        eq(graded_assignments.user_id, userId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!existing) {
    throw new Error("Assignment not found or not yours");
  }

  await db.transaction(async (tx) => {
    // 1) update assignment (no working_date)
    await tx
      .update(graded_assignments)
      .set({
        ...(args.name !== undefined ? { name: args.name } : {}),
        total_points:
          args.total_points !== undefined ? args.total_points : null,
        updated_date: formatDateTime(new Date()), // Date formatted like this: 2025-07-07 11:24:55
      })
      .where(eq(graded_assignments.id, args.id));

    // 2) delete old sections
    await tx
      .delete(assignment_sections)
      .where(eq(assignment_sections.graded_assignment_id, args.id));

    // 3) insert new sections
    for (const sec of args.sections) {
      await tx.insert(assignment_sections).values({
        id: randomUUID(),
        user_id: userId,
        class_id: existing.class_id,
        graded_assignment_id: args.id,
        name: sec.name,
        points: sec.points,
      });
    }
  });

  return args.id;
}
