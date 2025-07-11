"use server";

import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import { db } from "@/server/db/index";
import { grade_scales } from "@/server/db/schema";
import type { Grade } from "@/server/db/types";

export type CreateGradeScaleArgs = {
  id?: string;
  name: string;
  grades: Grade[];
};

export async function createGradeScale(
  args: CreateGradeScaleArgs,
): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("User ID is null");

  const id = randomUUID();
  await db.insert(grade_scales).values({
    id,
    name: args.name,
    user_id: userId,
    grades: args.grades,
  });

  return id;
}
