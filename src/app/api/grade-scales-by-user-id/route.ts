// src/app/api/grade-scales-by-user-id/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import type { InferModel } from "drizzle-orm";
import { db } from "@/server/db";
import { grade_scales } from "@/server/db/schema";

export const revalidate = 360; // ISR: 6 minutes
export const dynamic = "force-dynamic"; // always run on demand
export const runtime = "edge"; // edge runtime

// Type for a row from grade_scales
type GradeScaleRow = InferModel<typeof grade_scales, "select">;

export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // fetch all grade scales belonging to this user
    const scales: GradeScaleRow[] = await db
      .select()
      .from(grade_scales)
      .where(eq(grade_scales.user_id, userId));

    return NextResponse.json(scales, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error fetching grade scales:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
