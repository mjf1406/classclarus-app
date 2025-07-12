"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import type { GradeScale } from "@/server/db/types";
import {
  createGradeScale,
  type CreateGradeScaleArgs,
} from "../actions/createGradeScale";
import { v4 as uuidV4 } from "uuid";

interface Context {
  previous?: GradeScale[];
}

export function useCreateGradeScale() {
  const { userId } = useAuth();
  if (!userId) throw new Error("User ID is null");

  const queryClient = useQueryClient();
  const qKey = ["grade_scales"] as const;

  return useMutation<string, unknown, CreateGradeScaleArgs, Context>({
    // Call the server action
    mutationFn: (payload) => createGradeScale(payload),

    // Optimistic update
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<GradeScale[]>(qKey) ?? [];

      const optimistic: GradeScale = {
        id: uuidV4(),
        user_id: userId,
        name: payload.name,
        grades: payload.grades,
      };

      queryClient.setQueryData<GradeScale[]>(qKey, (old = []) => [
        ...old,
        optimistic,
      ]);

      return { previous };
    },

    onError: (err, _vars, ctx) => {
      console.error(err);
      toast.error("Error creating grade scale. Please try again.");
      if (ctx?.previous) {
        queryClient.setQueryData(qKey, ctx.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qKey });
    },
  });
}
