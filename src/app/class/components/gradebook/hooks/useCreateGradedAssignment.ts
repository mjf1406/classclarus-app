// src/app/class/components/gradebook/hooks/useCreateGradedAssignment.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createGradedAssignment,
  type CreateGradedAssignmentArgs,
} from "../actions/createGradedAssignment";
import type { Assignment } from "../GradedAssignmentsList";
import { useAuth } from "@clerk/nextjs";

interface Context {
  previous?: Assignment[];
}

export function useCreateGradedAssignment(classId: string) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  if (!userId) throw new Error("User ID is null");

  const qKey = ["graded_assignments", classId] as const;

  return useMutation<
    // <-- change this from Assignment to string
    string,
    unknown,
    CreateGradedAssignmentArgs,
    Context
  >({
    // server action returns the new ID
    mutationFn: (payload) => createGradedAssignment(payload),

    onMutate: (payload) => {
      // cancel any in‐flight fetches
      void queryClient.cancelQueries({ queryKey: qKey });

      // snapshot
      const previous = queryClient.getQueryData<Assignment[]>(qKey) ?? [];

      // build optimistic placeholder
      const optimistic: Assignment = {
        id: crypto.randomUUID(),
        user_id: userId,
        class_id: payload.class_id,
        name: payload.name,
        total_points: payload.total_points ?? 0,
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
        scores: [],
        sections: payload.sections.map((s) => ({
          id: crypto.randomUUID(),
          name: s.name,
          points: s.points,
          scores: [],
        })),
      };

      // insert immediately
      queryClient.setQueryData<Assignment[]>(qKey, (old = []) => [
        ...old,
        optimistic,
      ]);

      return { previous };
    },

    onError: (_err, _payload, ctx) => {
      // rollback
      if (ctx?.previous) {
        queryClient.setQueryData(qKey, ctx.previous);
      }
    },

    onSettled: () => {
      // refetch to get the real row back
      void queryClient.invalidateQueries({ queryKey: qKey });
    },
  });
}
