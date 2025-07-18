// src/app/class/components/random-events/actions/deleteRandomEvent.ts
"use server";

import { eq, and } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db/index";
import { random_events } from "@/server/db/schema";

export async function deleteRandomEvent(id: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  const exists = await db
    .select()
    .from(random_events)
    .where(and(eq(random_events.id, id), eq(random_events.user_id, userId)))
    .limit(1)
    .then((rows) => rows.length > 0);

  if (!exists) throw new Error("Random event not found or not yours");

  await db.delete(random_events).where(eq(random_events.id, id));
}
