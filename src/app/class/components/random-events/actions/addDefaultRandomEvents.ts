"use server";

import { randomUUID } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db/index";
import { random_events } from "@/server/db/schema";
import type { CreateRandomEventArgs } from "./createRandomEvent";

type DefaultEvent = Omit<CreateRandomEventArgs, "class_id">;

/**
 * Inserts multiple default events for the given class in one transaction.
 */
export async function addDefaultRandomEvents(
  classId: string,
  events: DefaultEvent[],
): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("User ID is null");

  await db.transaction(async (tx) => {
    for (const evt of events) {
      await tx.insert(random_events).values({
        id: randomUUID(),
        user_id: userId,
        class_id: classId,
        name: evt.name,
        description: evt.description ?? null,
        image: evt.image ?? null,
        audio: evt.audio ?? null,
        icon: evt.icon ?? null,
        selected: evt.selected,
      });
    }
  });
}
