// src\app\api\subject-comments-by-user-id\routes.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { subject_comments, type SubjectComment } from "@/server/db/schema";

// export const revalidate = 360;
export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows: SubjectComment[] = await db
      .select()
      .from(subject_comments)
      .where(eq(subject_comments.user_id, userId));

    return NextResponse.json(rows, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error fetching subject comments:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
