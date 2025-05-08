// src/app/api/class-by-id/[classId]/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { assigners, teacher_classes } from "@/server/db/schema";
import { db } from "@/server/db";

export const revalidate = 360;
export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const classId = searchParams.get("class_id");
  const { userId } = await auth();

  if (!classId) {
    return NextResponse.json(
      { error: "Missing 'class_id' search parameter." },
      { status: 400 }
    );
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const teacherRecords = await db
      .select()
      .from(teacher_classes)
      .where(
        and(
          eq(teacher_classes.class_id, classId),
          eq(teacher_classes.user_id, userId)
        )
      );

    if (teacherRecords.length === 0) {
      return NextResponse.json(
        { error: "Class not found or forbidden" },
        { status: 404 }
      );
    }

    const assignersData = await db
      .select()
      .from(assigners)
      .where(eq(assigners.user_id, userId));

    return NextResponse.json(assignersData, { status: 200 });
  } catch (error) {
    console.error("Error fetching class data:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
