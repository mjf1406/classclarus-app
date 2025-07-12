"use server";

import { db } from "@/server/db/index";
import { assignment_scores } from "@/server/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { auth } from "@clerk/nextjs/server";

export type UpdateStudentScoreArgs = {
  id?: string;
  student_id: string;
  class_id: string;
  graded_assignment_id: string;
  section_id?: string | null; // allow undefined or null
  score: number;
  excused: boolean;
};

export async function updateStudentScore(
  args: UpdateStudentScoreArgs,
): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  // normalize undefined → null
  const secId = args.section_id ?? null;

  return await db.transaction(async (tx) => {
    // build the section‐clause
    const sectionClause =
      secId !== null
        ? eq(assignment_scores.section_id, secId)
        : isNull(assignment_scores.section_id);

    // 1) find existing row
    const existing = await tx
      .select({ id: assignment_scores.id })
      .from(assignment_scores)
      .where(
        and(
          eq(assignment_scores.student_id, args.student_id),
          eq(assignment_scores.graded_assignment_id, args.graded_assignment_id),
          sectionClause,
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (existing) {
      // 2a) update
      await tx
        .update(assignment_scores)
        .set({
          score: args.score,
          excused: args.excused,
          user_id: userId,
          class_id: args.class_id,
        })
        .where(eq(assignment_scores.id, existing.id));
      return existing.id;
    } else {
      // 2b) insert (section_id will be NULL if secId===null)
      const id = args.id ?? randomUUID();
      await tx.insert(assignment_scores).values({
        id,
        student_id: args.student_id,
        user_id: userId,
        class_id: args.class_id,
        graded_assignment_id: args.graded_assignment_id,
        section_id: secId,
        score: args.score,
        excused: args.excused,
      });
      return id;
    }
  });
}
