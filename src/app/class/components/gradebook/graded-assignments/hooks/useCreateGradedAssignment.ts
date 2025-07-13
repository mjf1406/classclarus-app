// src\app\class\components\gradebook\graded-assignments\hooks\useCreateGradedAssignment.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { v4 as uuidV4 } from "uuid";
import {
  createGradedAssignment,
  type CreateGradedAssignmentArgs,
} from "../actions/createGradedAssignment";
import type { Assignment } from "../GradedAssignmentsList";

interface Context {
  previous?: Assignment[];
}

export function useCreateGradedAssignment(classId: string) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  if (!userId) throw new Error("User ID is null");

  const qKey = ["graded_assignments", classId] as const;

  return useMutation<string, unknown, CreateGradedAssignmentArgs, Context>({
    mutationFn: (payload) => createGradedAssignment(payload),
    onMutate: (payload) => {
      void queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<Assignment[]>(qKey) ?? [];

      const optimistic: Assignment = {
        id: uuidV4(),
        user_id: userId,
        class_id: payload.class_id,
        name: payload.name,
        total_points: payload.total_points ?? 0,
        scores: [],
        sections: payload.sections.map((s) => ({
          id: uuidV4(),
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
      toast.error(
        "Error creating Graded Assignment. Please try again in a moment.",
      );
      console.error(_err);
      if (ctx?.previous) {
        queryClient.setQueryData(qKey, ctx.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qKey });
    },
  });
}
