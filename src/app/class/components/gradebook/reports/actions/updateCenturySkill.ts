// src/app/class/components/reports/century-skills/actions/updateCenturySkill.ts
"use server";

import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import { db } from "@/server/db/index";
import { century_skills } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { CenturySkillAchievement } from "@/server/db/schema";

export type UpdateCenturySkillArgs = {
  id?: string;
  report_id: string;
  student_id: string;
  responsibility: CenturySkillAchievement;
  organization: CenturySkillAchievement;
  collaboration: CenturySkillAchievement;
  communication: CenturySkillAchievement;
  thinking: CenturySkillAchievement;
  inquiry: CenturySkillAchievement;
  risk_taking: CenturySkillAchievement;
  open_minded: CenturySkillAchievement;
};

export async function updateCenturySkill(
  args: UpdateCenturySkillArgs,
): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  return await db.transaction(async (tx) => {
    const existing = args.id
      ? await tx
          .select({ id: century_skills.id })
          .from(century_skills)
          .where(eq(century_skills.id, args.id))
          .limit(1)
          .then((rows) => rows[0])
      : null;

    if (existing) {
      await tx
        .update(century_skills)
        .set({
          report_id: args.report_id,
          student_id: args.student_id,
          responsibility: args.responsibility,
          organization: args.organization,
          collaboration: args.collaboration,
          communication: args.communication,
          thinking: args.thinking,
          inquiry: args.inquiry,
          risk_taking: args.risk_taking,
          open_minded: args.open_minded,
          user_id: userId,
        })
        .where(eq(century_skills.id, existing.id));
      return existing.id;
    } else {
      const id = args.id ?? randomUUID();
      await tx.insert(century_skills).values({
        id,
        user_id: userId,
        report_id: args.report_id,
        student_id: args.student_id,
        responsibility: args.responsibility,
        organization: args.organization,
        collaboration: args.collaboration,
        communication: args.communication,
        thinking: args.thinking,
        inquiry: args.inquiry,
        risk_taking: args.risk_taking,
        open_minded: args.open_minded,
      });
      return id;
    }
  });
}
