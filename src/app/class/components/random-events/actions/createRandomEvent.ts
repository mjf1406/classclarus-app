// src/app/class/components/random-events/actions/createRandomEvent.ts
"use server";

import { randomUUID } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db/index";
import { random_events } from "@/server/db/schema";
import type { RandomEvent } from "@/server/db/schema";

export type CreateRandomEventArgs = Omit<
  RandomEvent,
  "id" | "user_id" | "created_date" | "updated_date"
>;

export async function createRandomEvent(
  args: CreateRandomEventArgs,
): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("User ID is null");

  const id = randomUUID();

  await db.insert(random_events).values({
    id,
    user_id: userId,
    class_id: args.class_id,
    name: args.name,
    description: args.description ?? null,
    audio: args.audio ?? null,
    image: args.image ?? null,
    icon: args.icon ?? null,
    selected: args.selected,
  });

  return id;
}
