"use server";

import { db } from "@/server/db/index";
import {
  classes,
  teacher_classes,
  student_classes,
  // student_assignments,
  reward_items,
  behaviors,
  // student_expectations,
  // expectations,
  groups,
  student_groups,
  // achievements,
  points,
  absent_dates,
  // topics,
} from "@/server/db/schema";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import deleteStudentsByClassId from "./deleteStudentByClassId";

export default async function deleteClass(classId: string, role: string) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("User not authenticated:");

    if (role === "primary") {
      const groupIds = (
        await db
          .select({ gid: groups.group_id })
          .from(groups)
          .where(eq(groups.class_id, classId))
      ).map((r) => r.gid);

      if (groupIds.length > 0) {
        await db.delete(student_groups).where(inArray(student_groups.group_id, groupIds));
      }

      await db.delete(groups).where(eq(groups.class_id, classId));
      // await db.delete(achievements).where(eq(achievements.class_id, classId));
      await db.delete(points).where(eq(points.class_id, classId));
      await db.delete(absent_dates).where(eq(absent_dates.class_id, classId));
      // await db.delete(student_assignments).where(eq(student_assignments.class_id, classId));
      // await db.delete(student_expectations).where(eq(student_expectations.class_id, classId));
      // await db.delete(topics).where(eq(topics.class_id, classId));
      // await db.delete(expectations).where(eq(expectations.class_id, classId));
      await db.delete(reward_items).where(eq(reward_items.class_id, classId));
      await db.delete(behaviors).where(eq(behaviors.class_id, classId));
      await db.delete(student_classes).where(eq(student_classes.class_id, classId));
      await db.delete(teacher_classes).where(eq(teacher_classes.class_id, classId));
      await db.delete(classes).where(eq(classes.class_id, classId));
      await deleteStudentsByClassId(classId);
    } else if (role === "assistant") {
      await db.delete(teacher_classes).where(
        and(eq(teacher_classes.class_id, classId), eq(teacher_classes.user_id, userId))
      );
    }
  } catch (error) {
    console.error("Failed to delete class:", error);
    if (error instanceof Error) throw new Error(`Failed to delete class: ${error.message}`);
    throw new Error("Failed to delete class: An unknown error occurred.")
  }

  revalidatePath("/classes");
}
