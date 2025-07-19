// src/app/class/components/randomizations/actions/deleteRandomization.ts
"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db/index";
import { randomizations } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export async function deleteRandomization(id: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  const exists = await db
    .select()
    .from(randomizations)
    .where(and(eq(randomizations.id, id), eq(randomizations.user_id, userId)))
    .limit(1)
    .then((rows) => rows.length > 0);
  if (!exists) throw new Error("Randomization not found or not yours");

  await db.delete(randomizations).where(eq(randomizations.id, id));
}
