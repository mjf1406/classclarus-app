"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db/index";
import { graded_subjects } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function deleteGradedSubject(id: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  await db.delete(graded_subjects).where(eq(graded_subjects.id, id)).execute();
}
