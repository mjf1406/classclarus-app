// src/app/api/randomizations-by-class-id/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import {
  randomizations,
  randomizations_students,
  teacher_classes,
  type Randomization,
  type RandomizationStudent,
} from "@/server/db/schema";

// revalidate every 6 minutes, force dynamic, run on edge
export const revalidate = 360;
export const dynamic = "force-dynamic";
export const runtime = "edge";

// Type for the combined randomization with students
export type RandomizationWithStudents = Randomization & {
  students: RandomizationStudent[];
};

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

    // 2) load all randomizations for this class
    const randRows: Randomization[] = await db
      .select()
      .from(randomizations)
      .where(eq(randomizations.class_id, classId));

    const randIds = randRows.map((r) => r.id);

    // 3) load all student‐assignments for those randomizations
    let studentRows: RandomizationStudent[] = [];
    if (randIds.length > 0) {
      studentRows = await db
        .select()
        .from(randomizations_students)
        .where(
          and(
            eq(randomizations_students.class_id, classId),
            inArray(randomizations_students.randomization_id, randIds),
          ),
        );
    }

    // 4) group students by randomization_id
    const studentsByRand: Record<string, RandomizationStudent[]> = {};
    for (const s of studentRows) {
      studentsByRand[s.randomization_id] ??= [];
      studentsByRand[s.randomization_id]?.push(s);
    }

    // 5) assemble final payload
    const result: RandomizationWithStudents[] = randRows.map((r) => ({
      ...r,
      students: studentsByRand[r.id] ?? [],
    }));

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error fetching randomizations:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
