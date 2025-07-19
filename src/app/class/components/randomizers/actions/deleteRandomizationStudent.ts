// src/app/class/components/randomizations/actions/deleteRandomizationStudent.ts
"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db/index";
import { randomizations_students } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export async function deleteRandomizationStudent(id: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  const exists = await db
    .select()
    .from(randomizations_students)
    .where(
      and(
        eq(randomizations_students.id, id),
        eq(randomizations_students.user_id, userId),
      ),
    )
    .limit(1)
    .then((rows) => rows.length > 0);
  if (!exists) throw new Error("Assignment not found or not yours");

  await db
    .delete(randomizations_students)
    .where(eq(randomizations_students.id, id));
}
