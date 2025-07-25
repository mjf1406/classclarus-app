// src\app\class\components\gradebook\graded-assignments\hooks\useDeleteGradedAssignment.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Assignment } from "../GradedAssignmentsList";
import { deleteGradedAssignment } from "../actions/deleteGradedAssignment";

interface Context {
  previous?: Assignment[];
}

export function useDeleteGradedAssignment(classId: string) {
  const queryClient = useQueryClient();
  const qKey = ["graded_assignments", classId] as const;

  return useMutation<void, unknown, string, Context>({
    mutationFn: (id) => deleteGradedAssignment(id),

    onMutate: (id) => {
      // void is used here instead of await to ensure it happens in the background,
      // meaning the deleted item can be removed immediately from the UI
      void queryClient.cancelQueries({ queryKey: qKey });

      const previous = queryClient.getQueryData<Assignment[]>(qKey) ?? [];

      queryClient.setQueryData<Assignment[]>(
        qKey,
        previous.filter((a) => a.id !== id),
      );

      return { previous };
    },

    onError: (_err, _id, ctx) => {
      toast.error(
        "Error deleting Graded Assignment. Please try again in a moment.",
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
