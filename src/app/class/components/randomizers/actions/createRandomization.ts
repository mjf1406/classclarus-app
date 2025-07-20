// src/app/class/components/randomizations/actions/createRandomization.ts
"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db/index";
import { randomizations } from "@/server/db/schema";
import { formatDateTime } from "@/lib/utils";

export type CreateRandomizationArgs = {
  class_id: string;
  name: string;
  id: string;
};

export async function createRandomization(
  args: CreateRandomizationArgs,
): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  const now = formatDateTime(new Date());

  await db.insert(randomizations).values({
    id: args.id,
    user_id: userId,
    class_id: args.class_id,
    name: args.name,
    created_date: now,
    updated_date: now,
  });

  return args.id;
}
