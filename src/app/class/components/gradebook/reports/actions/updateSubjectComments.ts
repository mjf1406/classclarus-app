// src/app/class/components/reports/subject-comments/actions/updateSubjectComment.ts
"use server";

import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db/index";
import { subject_comments } from "@/server/db/schema";
import { tursoDateTime } from "@/lib/utils";

export type UpdateSubjectCommentArgs = {
  id?: string;
  report_id: string;
  comments: string;
};

export async function updateSubjectComment(
  args: UpdateSubjectCommentArgs,
): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  return await db.transaction(async (tx) => {
    // try to find an existing comment by report & user
    const existing = await tx
      .select({ id: subject_comments.id })
      .from(subject_comments)
      .where(
        and(
          eq(subject_comments.report_id, args.report_id),
          eq(subject_comments.user_id, userId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (existing) {
      // update the existing comment
      await tx
        .update(subject_comments)
        .set({
          comments: args.comments,
          updated_date: tursoDateTime(),
        })
        .where(eq(subject_comments.id, existing.id));
      return existing.id;
    } else {
      // insert a new comment
      const id = args.id ?? randomUUID();
      await tx.insert(subject_comments).values({
        id,
        user_id: userId,
        report_id: args.report_id,
        comments: args.comments,
      });
      return id;
    }
  });
}
