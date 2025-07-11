"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";
import {
  createGradedSubject,
  type CreateGradedSubjectArgs,
} from "../actions/createGradedSubject";
import type { GradedSubject } from "@/server/db/types";

// Mirror your API’s GradedSubject shape:
interface Context {
  previous?: GradedSubject[];
}

export function useCreateGradedSubject(classId: string) {
  const { userId } = useAuth();
  if (!userId) throw new Error("User not authenticated");

  const queryClient = useQueryClient();
  const qKey = ["graded_subjects", classId] as const;

  return useMutation<string, unknown, CreateGradedSubjectArgs, Context>({
    mutationFn: (args) => createGradedSubject(args),

    onMutate: (args) => {
      void queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<GradedSubject[]>(qKey);

      const optimistic: GradedSubject = {
        id: crypto.randomUUID(),
        user_id: userId,
        class_id: args.class_id,
        name: args.name,
        default_grade_scale: args.default_grade_scale,
        graded_assignment_ids: args.graded_assignment_ids,
        section_ids: args.section_ids,
      };

      queryClient.setQueryData<GradedSubject[]>(qKey, (old = []) => [
        ...old,
        optimistic,
      ]);

      return { previous };
    },

    onError: (err, _vars, ctx) => {
      console.error(err);
      toast.error("Failed to create subject. Please try again in a moment.");
      if (ctx?.previous) {
        queryClient.setQueryData(qKey, ctx.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qKey });
    },
  });
}
