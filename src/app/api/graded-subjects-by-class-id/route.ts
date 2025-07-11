// src/app/api/graded-subjects-by-class-id/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import type { InferModel } from "drizzle-orm";
import { db } from "@/server/db";
import { graded_subjects } from "@/server/db/schema";

export const revalidate = 360; // ISR: 6 minutes
export const dynamic = "force-dynamic"; // always run on demand
export const runtime = "edge"; // edge runtime

// Type for a row from graded_subjects
type GradedSubjectRow = InferModel<typeof graded_subjects, "select">;

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const classId = request.nextUrl.searchParams.get("class_id");
  if (!classId) {
    return NextResponse.json(
      { error: "Missing or invalid class_id" },
      { status: 400 },
    );
  }

  try {
    const subjects: GradedSubjectRow[] = await db
      .select()
      .from(graded_subjects)
      .where(
        and(
          eq(graded_subjects.class_id, classId),
          eq(graded_subjects.user_id, userId),
        ),
      );
    return NextResponse.json(subjects, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error fetching graded subjects:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
