// src/app/class/components/randomizations/actions/updateRandomizationStudent.ts
"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db/index";
import { randomizations, randomizations_students } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export type UpdateRandomizationStudentArgs = {
  id: string;
  student_id: string;
  randomization_id?: string;
  checked: boolean;
};

export async function updateRandomizationStudent(
  args: UpdateRandomizationStudentArgs,
): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  // 1) verify ownership
  const existing = await db
    .select({
      user_id: randomizations_students.user_id,
      class_id: randomizations_students.class_id,
      randomization_id: randomizations_students.randomization_id,
    })
    .from(randomizations_students)
    .where(
      and(
        eq(randomizations_students.id, args.id),
        eq(randomizations_students.user_id, userId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);
  if (!existing) throw new Error("Entry not found or not yours");

  // 2) verify new parent if changing randomization (optional)
  if (
    args.randomization_id &&
    args.randomization_id !== existing.randomization_id
  ) {
    const parent = await db
      .select()
      .from(randomizations)
      .where(
        and(
          eq(randomizations.id, args.randomization_id),
          eq(randomizations.user_id, userId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);
    if (!parent || parent.class_id !== existing.class_id) {
      throw new Error("Target randomization not found or forbidden");
    }
  }

  // 3) persist
  await db
    .update(randomizations_students)
    .set({
      student_id: args.student_id,
      randomization_id: args.randomization_id ?? existing.randomization_id,
      checked: args.checked,
    })
    .where(eq(randomizations_students.id, args.id));

  return args.id;
}
