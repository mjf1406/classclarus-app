// src/app/class/components/gradebook/hooks/useUpdateGradedAssignment.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateGradedAssignment,
  type UpdateGradedAssignmentArgs,
} from "../actions/updateGradedAssignment";
import type { Assignment } from "../GradedAssignmentsList";

const genId = () => crypto.randomUUID();

interface Context {
  previous?: Assignment[];
}

export function useUpdateGradedAssignment(classId: string) {
  const queryClient = useQueryClient();
  const qKey = ["graded_assignments", classId] as const;

  return useMutation<
    // ← the server action returns Promise<string> (the assignment ID)
    string,
    unknown,
    UpdateGradedAssignmentArgs,
    Context
  >({
    // 1) call your server‐action
    mutationFn: (args) => updateGradedAssignment(args),

    // 2) optimistic patch
    onMutate: (args) => {
      // cancel any in‐flight fetches
      void queryClient.cancelQueries({ queryKey: qKey });

      // snapshot
      const previous = queryClient.getQueryData<Assignment[]>(qKey) ?? [];

      // build our “updated” version
      const updated: Assignment = {
        id: args.id,
        user_id: previous.find((a) => a.id === args.id)?.user_id ?? "",
        class_id: args.class_id,
        name: args.name ?? "",
        total_points: args.total_points ?? 0,
        created_date:
          previous.find((a) => a.id === args.id)?.created_date ??
          new Date().toISOString(),
        updated_date: new Date().toISOString(),
        sections: args.sections.map((s) => ({
          id: genId(),
          name: s.name,
          points: s.points,
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
