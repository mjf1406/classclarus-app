// src\app\api\graded-assignments-by-class-id\route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and, inArray } from "drizzle-orm";
import type { InferModel } from "drizzle-orm";
import { db } from "@/server/db";
import {
  graded_assignments,
  assignment_sections,
  assignment_scores,
  teacher_classes,
} from "@/server/db/schema";

export const revalidate = 360;
export const dynamic = "force-dynamic";
export const runtime = "edge";

// infer the exact row shapes
type AssignmentRow = InferModel<typeof graded_assignments, "select">;
type SectionRow = InferModel<typeof assignment_sections, "select">;
type ScoreRow = InferModel<typeof assignment_scores, "select">;

export async function GET(request: NextRequest) {
  const classId = request.nextUrl.searchParams.get("class_id");
  const { userId } = await auth();

  if (!classId) {
    return NextResponse.json(
      { error: "Missing 'class_id' param." },
      { status: 400 },
    );
  }
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1) verify teacher owns the class
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

    // 2) load all assignments for this class
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

    // 4) load all scores for this class & those assignments
    let scores: ScoreRow[] = [];
    if (assignmentIds.length > 0) {
      scores = await db
        .select({
          id: assignment_scores.id,
          student_id: assignment_scores.student_id,
          user_id: assignment_scores.user_id,
          class_id: assignment_scores.class_id,
          graded_assignment_id: assignment_scores.graded_assignment_id,
          section_id: assignment_scores.section_id,
          score: assignment_scores.score,
          excused: assignment_scores.excused,
        })
        .from(assignment_scores)
        .where(
          and(
            eq(assignment_scores.class_id, classId),
            inArray(assignment_scores.graded_assignment_id, assignmentIds),
          ),
        );
    }

    // 5) group sections by assignment
    const sectionsByAssignment: Record<string, SectionRow[]> = {};
    for (const sec of sections) {
      const arr = sectionsByAssignment[sec.graded_assignment_id] ?? [];
      arr.push(sec);
      sectionsByAssignment[sec.graded_assignment_id] = arr;
    }

    // 6) group scores both at assignment‐level and section‐level
    const scoresByAssignment: Record<string, ScoreRow[]> = {};
    const scoresBySection: Record<string, ScoreRow[]> = {};
    for (const sc of scores) {
      // assignment‐level
      const aArr = scoresByAssignment[sc.graded_assignment_id] ?? [];
      aArr.push(sc);
      scoresByAssignment[sc.graded_assignment_id] = aArr;

      // section‐level (only if non‐null)
      if (sc.section_id !== null) {
        const sArr = scoresBySection[sc.section_id] ?? [];
        sArr.push(sc);
        scoresBySection[sc.section_id] = sArr;
      }
    }

    // 7) assemble final JSON
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

        // each section carries its own scores[]
        sections: secs.map((s) => ({
          id: s.id,
          name: s.name,
          points: s.points,
          scores: scoresBySection[s.id] ?? [],
        })),

        // plus a flat list of all scores for this assignment
        scores: scoresByAssignment[a.id] ?? [],
      };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error fetching graded assignments:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
