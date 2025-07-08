// src/app/api/graded-assignments-by-class-id/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and, inArray } from "drizzle-orm";
import type { InferModel } from "drizzle-orm";
import { db } from "@/server/db";
import {
  graded_assignments,
  assignment_sections,
  teacher_classes,
} from "@/server/db/schema";

export const revalidate = 360;
export const dynamic = "force-dynamic";
export const runtime = "edge";

// these infer the shape of a row when you do `.select()`
type AssignmentRow = InferModel<typeof graded_assignments, "select">;
type SectionRow = InferModel<typeof assignment_sections, "select">;

export async function GET(request: NextRequest) {
  const classId = request.nextUrl.searchParams.get("class_id");
  const { userId } = await auth();

  if (!classId) {
    return NextResponse.json(
      { error: "Missing 'class_id' search parameter." },
      { status: 400 },
    );
  }
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1) verify they teach this class
    const teach = await db
      .select()
      .from(teacher_classes)
      .where(
        and(
          eq(teacher_classes.class_id, classId),
          eq(teacher_classes.user_id, userId),
        ),
      );

    if (teach.length === 0) {
      return NextResponse.json(
        { error: "Class not found or forbidden" },
        { status: 404 },
      );
    }

    // 2) load all assignments
    const assignments: AssignmentRow[] = await db
      .select()
      .from(graded_assignments)
      .where(eq(graded_assignments.class_id, classId));

    const assignmentIds = assignments.map((a) => a.id);

    // 3) load all sections for those assignments
    let sections: SectionRow[] = [];
    if (assignmentIds.length > 0) {
      sections = await db
        .select()
        .from(assignment_sections)
        .where(
          inArray(assignment_sections.graded_assignment_id, assignmentIds),
        );
    }

    // 4) group them by graded_assignment_id
    const sectionsByAssignment: Record<string, SectionRow[]> = {};
    for (const s of sections) {
      const key = s.graded_assignment_id;
      sectionsByAssignment[key] ??= [];
      sectionsByAssignment[key].push(s);
    }

    // 5) merge into the final payload
    const result = assignments.map((a) => {
      const secs = sectionsByAssignment[a.id] ?? [];
      return {
        id: a.id,
        user_id: a.user_id,
        class_id: a.class_id,
        name: a.name,
        total_points: a.total_points,
        created_date: a.created_date,
        updated_date: a.updated_date,
        sections: secs.map((s) => ({
          id: s.id,
          name: s.name,
          points: s.points,
        })),
      };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    // narrow before logging/returning
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error fetching graded assignments:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
