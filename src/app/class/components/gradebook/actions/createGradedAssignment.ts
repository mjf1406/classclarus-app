// app/_actions/gradedAssignment.ts
"use server";

import { db } from "@/server/db/index";
import { graded_assignments, assignment_sections } from "@/server/db/schema";
import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";

export type SectionInput = {
  name: string;
  points: number;
};

export type CreateGradedAssignmentArgs = {
  class_id: string;
  name: string;
  total_points?: number | null;
  sections: SectionInput[];
};

/**
 * Inserts a new graded assignment plus its sections in a single transaction.
 */
export async function createGradedAssignment(args: CreateGradedAssignmentArgs) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("User ID is null");
  }
  const assignmentId = randomUUID();

  await db.transaction(async (tx) => {
    // 1) Insert into graded_assignments
    await tx.insert(graded_assignments).values({
      id: assignmentId,
      user_id: userId,
      class_id: args.class_id,
      name: args.name,
      total_points: args.total_points ?? null,
    });

    // 2) Insert each section
    for (const sec of args.sections) {
      await tx.insert(assignment_sections).values({
        id: randomUUID(),
        user_id: userId,
        class_id: args.class_id,
        graded_assignment_id: assignmentId,
        name: sec.name,
        points: sec.points,
      });
    }
  });

  return assignmentId;
}
