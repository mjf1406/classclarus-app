// src/app/class/components/random-events/actions/deleteRandomEvent.ts
"use server";

import { eq, and } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db/index";
import { random_events } from "@/server/db/schema";
// import { utapi } from "@/lib/uploadthing";
import { UTApi } from "uploadthing/server";

export async function deleteRandomEvent(id: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  const utapi = new UTApi();

  // First, get the random event to check for associated files
  const randomEvent = await db
    .select()
    .from(random_events)
    .where(and(eq(random_events.id, id), eq(random_events.user_id, userId)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!randomEvent) throw new Error("Random event not found or not yours");

  // Extract file keys from UploadThing URLs
  const uploadThingAppId = process.env.UPLOADTHING_APP_ID;
  const uploadThingPattern = `https://${uploadThingAppId}.ufs.sh/f/`;
  const uploadThingPatternDeprecated = `https://utfs.io/f/`;
  const filesToDelete: string[] = [];

  // Check image URL
  if (randomEvent.image?.startsWith(uploadThingPattern)) {
    const fileKey = randomEvent.image.replace(uploadThingPattern, "");
    filesToDelete.push(fileKey);
  } else if (randomEvent.image?.startsWith(uploadThingPatternDeprecated)) {
    const fileKey = randomEvent.image.replace(uploadThingPatternDeprecated, "");
    filesToDelete.push(fileKey);
  }

  // Check audio URL
  if (randomEvent.audio?.startsWith(uploadThingPattern)) {
    const fileKey = randomEvent.audio.replace(uploadThingPattern, "");
    filesToDelete.push(fileKey);
  } else if (randomEvent.audio?.startsWith(uploadThingPatternDeprecated)) {
    const fileKey = randomEvent.audio.replace(uploadThingPatternDeprecated, "");
    filesToDelete.push(fileKey);
  }

  if (randomEvent.old_files) {
    for (const element of randomEvent.old_files) {
      if (element.startsWith(uploadThingPattern)) {
        const fileKey = element.replace(uploadThingPattern, "");
        filesToDelete.push(fileKey);
      } else if (element.startsWith(uploadThingPatternDeprecated)) {
        const fileKey = element.replace(uploadThingPatternDeprecated, "");
        filesToDelete.push(fileKey);
      }
    }
  }

  // Delete files from UploadThing if any were found
  if (filesToDelete.length > 0) {
    try {
      await utapi.deleteFiles(filesToDelete);
    } catch (error) {
      console.error("Failed to delete files from UploadThing:", error);
      // Continue with database deletion even if file deletion fails
    }
  }

  // Delete the random event from the database
  await db.delete(random_events).where(eq(random_events.id, id));
}
