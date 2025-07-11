"use server";

import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import { db } from "@/server/db/index";
import { graded_subjects } from "@/server/db/schema";

export type CreateGradedSubjectArgs = {
  class_id: string;
  name: string;
  default_grade_scale: string;
  graded_assignment_ids: string[];
  section_ids: string[];
};

export async function createGradedSubject(
  args: CreateGradedSubjectArgs,
): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("User must be authenticated");
  }

  const id = randomUUID();
  await db.insert(graded_subjects).values({
    id,
    user_id: userId,
    class_id: args.class_id,
    name: args.name,
    default_grade_scale: args.default_grade_scale,
    graded_assignment_ids: args.graded_assignment_ids,
    section_ids: args.section_ids,
  });

  return id;
}
