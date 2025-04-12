// src/app/api/points-by-class-id/[classId]/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { points } from "@/server/db/schema";
import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";

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
    const pointsData = await db
      .select()
      .from(points)
      .where(eq(points.class_id, classId));

    return NextResponse.json(pointsData, { status: 200 });
  } catch (error) {
    console.error("Error fetching points data:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
