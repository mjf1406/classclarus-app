// src/app/class/components/randomizations/actions/updateRandomization.ts
"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db/index";
import { randomizations } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { formatDateTime } from "@/lib/utils";

export type UpdateRandomizationArgs = {
  id: string;
  name: string;
};

/**
 * Update a randomization row in place.
 */
export async function updateRandomization(
  args: UpdateRandomizationArgs,
): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  const existing = await db
    .select()
    .from(randomizations)
    .where(
      and(eq(randomizations.id, args.id), eq(randomizations.user_id, userId)),
    )
    .limit(1)
    .then((rows) => rows[0]);
  if (!existing) throw new Error("Randomization not found or not yours");

  await db
    .update(randomizations)
    .set({
      name: args.name,
      updated_date: formatDateTime(new Date()),
    })
    .where(eq(randomizations.id, args.id));

  return args.id;
}
