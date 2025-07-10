// app/_actions/gradedAssignment.ts
"use server";

import { db } from "@/server/db/index";
import { graded_assignments, assignment_sections } from "@/server/db/schema";
import type { SectionInput } from "./createGradedAssignment";
import type { AssignmentScore } from "@/server/db/types";
import { and, eq, not, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { formatDateTime } from "@/lib/utils";

export type UpdateGradedAssignmentArgs = {
  id: string;
  class_id: string;
  name?: string;
  total_points?: number | null;
  sections: SectionInput[]; // now SectionInput has optional `id`
  scores?: AssignmentScore[];
};

export async function updateGradedAssignment(
  args: UpdateGradedAssignmentArgs,
): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  // 0) verify it exists & you own it
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
  if (!existing) throw new Error("Assignment not found or not yours");

  await db.transaction(async (tx) => {
    // 1) update the assignment row
    await tx
      .update(graded_assignments)
      .set({
        ...(args.name !== undefined ? { name: args.name } : {}),
        total_points:
          args.total_points !== undefined ? args.total_points : null,
        updated_date: formatDateTime(new Date()),
      })
      .where(eq(graded_assignments.id, args.id));

    // 2) delete only those sections the user actually removed
    const incomingIds = args.sections
      .map((s) => s.id)
      .filter((id): id is string => Boolean(id));
    if (incomingIds.length > 0) {
      await tx.delete(assignment_sections).where(
        and(
          eq(assignment_sections.graded_assignment_id, args.id),
          // this is the replacement for `notIn`:
          not(inArray(assignment_sections.id, incomingIds)),
        ),
      );
    } else {
      // user cleared *all* sections:
      await tx
        .delete(assignment_sections)
        .where(eq(assignment_sections.graded_assignment_id, args.id));
    }

    // 3) upsert each incoming section
    for (const sec of args.sections) {
      if (sec.id) {
        // existing → just update
        await tx
          .update(assignment_sections)
          .set({ name: sec.name, points: sec.points })
          .where(eq(assignment_sections.id, sec.id));
      } else {
        // brand-new → insert
        await tx.insert(assignment_sections).values({
          id: randomUUID(),
          user_id: userId,
          class_id: existing.class_id,
          graded_assignment_id: args.id,
          name: sec.name,
          points: sec.points,
        });
      }
    }
  });

  return args.id;
}
