"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AssignmentScore } from "@/server/db/types";
import { useAuth } from "@clerk/nextjs";
import {
  updateStudentScore,
  type UpdateStudentScoreArgs,
} from "../actions/updateStudentScore";

interface Context {
  previous?: AssignmentScore[];
}

export function useUpdateStudentScore(
  classId: string,
  gradedAssignmentId: string,
) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  if (!userId) throw new Error("Not authenticated");

  const queryKey = ["assignment_scores", classId, gradedAssignmentId] as const;

  return useMutation<string, unknown, UpdateStudentScoreArgs, Context>({
    mutationFn: (args) =>
      updateStudentScore({
        ...args,
        section_id: args.section_id === "__total" ? null : args.section_id,
      }),

    onMutate: async (args) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous
      const previous =
        queryClient.getQueryData<AssignmentScore[]>(queryKey) ?? [];

      // Build optimistic row
      const newId = args.id ?? crypto.randomUUID();
      const optimistic: AssignmentScore = {
        id: newId,
        student_id: args.student_id,
        user_id: userId,
        class_id: args.class_id,
        graded_assignment_id: gradedAssignmentId,
        section_id: args.section_id === "__total" ? null : args.section_id,
        score: args.score,
        excused: args.excused,
      };

      // Upsert into cache
      const next = previous.slice();
      const idx = next.findIndex(
        (r) =>
          r.student_id === args.student_id && r.section_id === args.section_id,
      );
      if (idx > -1) next[idx] = optimistic;
      else next.push(optimistic);

      queryClient.setQueryData(queryKey, next);

      return { previous };
    },

    onError: (_err, _args, ctx) => {
      toast.error("Error saving change. Please try again in a moment.");
      console.error(_err);
      if (ctx?.previous) {
        queryClient.setQueryData(queryKey, ctx.previous);
      }
    },

    onSettled: () => {
      // re‐fetch to get the real data back
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}
