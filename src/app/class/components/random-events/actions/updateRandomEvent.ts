// src/app/class/components/random-events/actions/updateRandomEvent.ts
"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db/index";
import { random_events } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { tursoDateTime } from "@/lib/utils";

export type UpdateRandomEventArgs = {
  id: string;
  name: string;
  description?: string;
  image?: string;
  audio?: string;
  icon?: string;
  selected: boolean;
};

export async function updateRandomEvent(
  args: UpdateRandomEventArgs,
): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  // verify ownership and get current data
  const existing = await db
    .select()
    .from(random_events)
    .where(
      and(eq(random_events.id, args.id), eq(random_events.user_id, userId)),
    )
    .limit(1)
    .then((rows) => rows[0]);
  if (!existing) throw new Error("Random event not found or not yours");

  // Collect old files that are being replaced
  const oldFiles: string[] = [];
  const currentOldFiles: string[] = existing.old_files ?? [];

  if (args.image && existing.image && existing.image !== args.image) {
    oldFiles.push(existing.image);
  }
  if (args.audio && existing.audio && existing.audio !== args.audio) {
    oldFiles.push(existing.audio);
  }

  // Combine with existing old files
  const updatedOldFiles = [...currentOldFiles, ...oldFiles];

  await db
    .update(random_events)
    .set({
      name: args.name,
      description: args.description ?? null,
      image: args.image ?? null,
      audio: args.audio ?? null,
      icon: args.icon ?? null,
      selected: args.selected,
      old_files: updatedOldFiles.length > 0 ? updatedOldFiles : [],
      updated_date: tursoDateTime(),
    })
    .where(eq(random_events.id, args.id));

  return args.id;
}
