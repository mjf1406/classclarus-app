"use server";

import { getUserRoleByClassId } from "@/server/db/actions/getUserClassRoleByClassId";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function deleteClassById(classId: string) {
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

  const permissions = await getUserRoleByClassId(classId)

  
}
