import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "..";
import { and, eq } from "drizzle-orm";
import { teacher_classes } from "../schema";

export async function getUserRoleByClassId(classId: string) {
  if (!classId) {
    return NextResponse.json(
      { error: "Missing 'class_id' search parameter." },
      { status: 400 },
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await db
    .select()
    .from(teacher_classes)
    .where(
      and(
        eq(teacher_classes.user_id, userId),
        eq(teacher_classes.class_id, classId),
      ),
    )
    .limit(1);
  
    return data[0]?.role ?? null
}
