// src\app\class\components\gradebook\graded-assignments\hooks\useUpdateGradedAssignment.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateGradedAssignment,
  type UpdateGradedAssignmentArgs,
} from "../actions/updateGradedAssignment";
import type { Assignment } from "../GradedAssignmentsList";
import { toast } from "sonner";
import { v4 as uuidV4 } from "uuid";

const genId = () => uuidV4();

interface Context {
  previous?: Assignment[];
}

export function useUpdateGradedAssignment(classId: string) {
  const queryClient = useQueryClient();
  const qKey = ["graded_assignments", classId] as const;

  return useMutation<string, unknown, UpdateGradedAssignmentArgs, Context>({
    mutationFn: (args) => updateGradedAssignment(args),
    onMutate: (args) => {
      void queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<Assignment[]>(qKey) ?? [];

      const updated: Assignment = {
        id: args.id,
        user_id: previous.find((a) => a.id === args.id)?.user_id ?? "",
        class_id: args.class_id,
        name: args.name ?? "",
        total_points: args.total_points ?? 0,
        scores: args.scores ?? [],
        sections: args.sections.map((s) => ({
          id: genId(),
          name: s.name,
          points: s.points,
          scores: s.scores ?? [],
        })),
      };

      // write into cache
      queryClient.setQueryData<Assignment[]>(qKey, (old = []) =>
        old.map((a) => (a.id === args.id ? updated : a)),
      );

      return { previous };
    },

    // 3) rollback on error
    onError: (_err, _args, ctx) => {
      toast.error(
        "Error updating Graded Assignment. Please try again in a moment.",
      );
      console.error(_err);
      if (ctx?.previous) {
        queryClient.setQueryData(qKey, ctx.previous);
      }
    },

    // 4) refetch after settle
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qKey });
    },
  });
}
