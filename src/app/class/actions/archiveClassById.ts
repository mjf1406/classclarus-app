"use server";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserRoleByClassId } from "../../../server/db/actions/getUserClassRoleByClassId";
import { classes } from "@/server/db/schema";
import { db } from "@/server/db";
import { eq } from "drizzle-orm";

export async function archiveClassById(classId: string, role: string) {
  if (!classId) {
    return NextResponse.json(
      { error: "Missing 'class_id' search parameter." },
      { status: 400 },
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roleServer = await getUserRoleByClassId(classId);

  if (roleServer === role && role === "primary" && roleServer === "primary") {
    try {
      await db
        .update(classes)
        .set({ archived: true })
        .where(eq(classes.class_id, classId));
    } catch (error) {
      console.error("Error archiving class:", error);
      return NextResponse.json(
        { error: "Failed to archive class." },
        { status: 500 }
      );
    }
  } else {
    return NextResponse.json(
      { error: "Permission denied." },
      { status: 403 }
    );
  }

  return { success: true }
}
