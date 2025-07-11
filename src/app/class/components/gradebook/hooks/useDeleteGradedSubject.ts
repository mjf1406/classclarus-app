"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteGradedSubject } from "../actions/deleteGradedSubject";
import type { GradedSubject } from "@/server/db/types";

interface Context {
  previous?: GradedSubject[];
}

export function useDeleteGradedSubject(classId: string) {
  const queryClient = useQueryClient();
  const qKey = ["graded_subjects", classId] as const;

  return useMutation<void, unknown, string, Context>({
    mutationFn: (id) => deleteGradedSubject(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<GradedSubject[]>(qKey);

      queryClient.setQueryData<GradedSubject[]>(qKey, (old = []) =>
        old.filter((subj) => subj.id !== id),
      );

      return { previous };
    },

    onError: (_err, _id, context) => {
      toast.error("Failed to delete subject");
      if (context?.previous) {
        queryClient.setQueryData(qKey, context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qKey });
    },
  });
}
