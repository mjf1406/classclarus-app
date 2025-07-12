// src/app/api/reports-by-class-id/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import type { InferModel } from "drizzle-orm";
import { db } from "@/server/db";
import { reports, teacher_classes } from "@/server/db/schema";

export const revalidate = 360;
export const dynamic = "force-dynamic";
export const runtime = "edge";

type ReportRow = InferModel<typeof reports, "select">;

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

    // 2) load all reports for this class
    const rows: ReportRow[] = await db
      .select()
      .from(reports)
      .where(eq(reports.class_id, classId));

    return NextResponse.json(rows, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error fetching reports:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
