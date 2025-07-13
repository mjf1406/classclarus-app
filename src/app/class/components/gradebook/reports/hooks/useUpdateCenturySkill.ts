// src/app/class/components/reports/century-skills/hooks/useUpdateCenturySkill.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { v4 as uuidV4 } from "uuid";
import { useAuth } from "@clerk/nextjs";
import {
  updateCenturySkill,
  type UpdateCenturySkillArgs,
} from "../actions/updateCenturySkill";
import type { CenturySkill } from "@/server/db/schema";

interface Context {
  previous?: CenturySkill[];
}

export function useUpdateCenturySkill(classId: string) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  if (!userId) throw new Error("Not authenticated");

  const queryKey = ["century_skills", classId] as const;

  return useMutation<string, unknown, UpdateCenturySkillArgs, Context>({
    mutationFn: (args) => updateCenturySkill(args),

    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CenturySkill[]>(queryKey) ?? [];

      const newId = args.id ?? uuidV4();
      const optimistic: CenturySkill = {
        id: newId,
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
      };

      const next = previous.slice();
      const idx = next.findIndex((c) => c.id === args.id);
      if (idx > -1) next[idx] = optimistic;
      else next.push(optimistic);

      queryClient.setQueryData(queryKey, next);
      return { previous };
    },

    onError: (_err, _args, ctx) => {
      toast.error("Error saving century skill. Please try again.");
      console.error(_err);
      if (ctx?.previous) {
        queryClient.setQueryData(queryKey, ctx.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}
