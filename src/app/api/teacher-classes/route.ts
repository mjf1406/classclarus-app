// src/app/api/teacher-classes/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { classes, teacher_classes } from "@/server/db/schema";
import { db } from "@/server/db";

export const revalidate = 360; // Revalidate data every 30s (ISR-like caching)
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Join teacher_classes and classes to return complete info.
    const teacherClasses = await db
      .select({
        teacherAssignment: teacher_classes,
        classInfo: classes,
      })
      .from(teacher_classes)
      .innerJoin(classes, eq(teacher_classes.class_id, classes.class_id))
      .where(eq(teacher_classes.user_id, userId));

    return NextResponse.json(teacherClasses, { status: 200 });
  } catch (error) {
    console.error("Error fetching teacher classes:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
