"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db/index";
import { graded_subjects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export type UpdateGradedSubjectArgs = {
  id: string;
  class_id: string;
  name: string;
  default_grade_scale: string;
  graded_assignment_ids: string[];
  section_ids: string[];
};

/**
 * Update a graded‐subject row in place.
 */
export async function updateGradedSubject(
  args: UpdateGradedSubjectArgs,
): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  // verify ownership
  const existing = await db
    .select()
    .from(graded_subjects)
    .where(
      and(eq(graded_subjects.id, args.id), eq(graded_subjects.user_id, userId)),
    )
    .limit(1)
    .then((rows) => rows[0]);
  if (!existing) throw new Error("Subject not found or not yours");

  await db
    .update(graded_subjects)
    .set({
      name: args.name,
      default_grade_scale: args.default_grade_scale,
      graded_assignment_ids: args.graded_assignment_ids,
      section_ids: args.section_ids,
    })
    .where(eq(graded_subjects.id, args.id));

  return args.id;
}
