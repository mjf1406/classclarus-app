"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteGradeScale } from "../actions/deleteGradeScale";
import type { GradeScale } from "@/server/db/types";

interface Context {
  previous?: GradeScale[];
}

/**
 * useDeleteGradeScale()
 * - mutate(id: string)
 * - optimistically removes from ["grade_scales"] cache
 * - rollbacks on error, refetches on settle
 */
export function useDeleteGradeScale() {
  const queryClient = useQueryClient();
  const qKey = ["grade_scales"] as const;

  return useMutation<void, unknown, string, Context>({
    // 1) call server-action
    mutationFn: (id) => deleteGradeScale(id),

    // 2) optimistic update
    onMutate: (id) => {
      void queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<GradeScale[]>(qKey);
      if (previous) {
        queryClient.setQueryData<GradeScale[]>(
          qKey,
          previous.filter((s) => s.id !== id),
        );
      }
      return { previous };
    },

    // 3) rollback on error
    onError: (_err, _id, ctx) => {
      toast.error("Error deleting grade scale. Please try again.");
      if (ctx?.previous) {
        queryClient.setQueryData(qKey, ctx.previous);
      }
    },

    // 4) refetch on settled
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qKey });
    },
  });
}
