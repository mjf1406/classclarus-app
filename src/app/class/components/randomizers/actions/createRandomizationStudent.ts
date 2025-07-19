// src/app/class/components/randomizations/actions/createRandomizationStudent.ts
"use server";

import { randomUUID } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db/index";
import { randomizations, randomizations_students } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { tursoDateTime } from "@/lib/utils";

export type CreateRandomizationStudentArgs = {
  randomization_id: string;
  student_id: string;
  position: number;
};

export async function createRandomizationStudent(
  args: CreateRandomizationStudentArgs,
): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  // verify parent randomization & ownership
  const parent = await db
    .select({ class_id: randomizations.class_id })
    .from(randomizations)
    .where(
      and(
        eq(randomizations.id, args.randomization_id),
        eq(randomizations.user_id, userId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);
  if (!parent) throw new Error("Randomization not found or not yours");

  const id = randomUUID();
  const now = tursoDateTime();

  await db.insert(randomizations_students).values({
    id,
    user_id: userId,
    class_id: parent.class_id,
    randomization_id: args.randomization_id,
    student_id: args.student_id,
    position: args.position,
    checked: false,
    created_date: now,
    updated_date: now,
  });

  return id;
}
