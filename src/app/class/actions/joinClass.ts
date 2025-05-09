"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { classes, teacher_classes } from "@/server/db/schema";
import type { Class } from "@/server/db/types";
import { generateUuidWithPrefix } from "@/lib/helperFunctions";

export async function joinClass(classCode: string) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("User not authenticated.");

    const classDataArray: Class[] = await db
      .select()
      .from(classes)
      .where(eq(classes.class_code, classCode))
      .limit(1);

    const classData: Class | undefined = classDataArray[0];

    if (!classData?.class_id) throw new Error("Class ID is undefined.");

    await db.insert(teacher_classes).values({
      assignment_id: generateUuidWithPrefix("assignment_"),
      user_id: userId,
      class_id: classData.class_id,
      role: "assistant",
    });

    return { success: true, message: null };
  } catch (error: unknown) {
    console.error(error);

    if (error instanceof Error) {
      return { success: false, message: error.message };
    }

    return { success: false, message: "An unknown error occurred." };
  }
}
