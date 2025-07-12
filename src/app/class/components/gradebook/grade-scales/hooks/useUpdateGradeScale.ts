"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  updateGradeScale,
  type UpdateGradeScaleArgs,
} from "../actions/updateGradeScale";
import type { GradeScale } from "@/server/db/types";

interface Context {
  previous?: GradeScale[];
}

/**
 * Hook to update a single grade scale. Invalidates ["grade_scales"] on settle.
 */
export function useUpdateGradeScale() {
  const queryClient = useQueryClient();
  const qKey = ["grade_scales"] as const;

  return useMutation<
    // returns the updated id
    string,
    unknown,
    UpdateGradeScaleArgs,
    Context
  >({
    mutationFn: (args) => updateGradeScale(args),

    // optimistic update
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<GradeScale[]>(qKey);

      if (previous) {
        const patched = previous.map((gs) =>
          gs.id === args.id
            ? {
                ...gs,
                name: args.name ?? gs.name,
                grades: args.grades ?? gs.grades,
              }
            : gs,
        );
        queryClient.setQueryData(qKey, patched);
      }

      return { previous };
    },

    // rollback on error
    onError: (_err, _args, ctx) => {
      toast.error("Error updating grade scale. Please try again in a moment.");
      if (ctx?.previous) {
        queryClient.setQueryData(qKey, ctx.previous);
      }
    },

    // always refetch after mutation
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qKey });
    },
  });
}
