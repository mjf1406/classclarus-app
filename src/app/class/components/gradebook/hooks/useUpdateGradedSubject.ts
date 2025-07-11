"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  updateGradedSubject,
  type UpdateGradedSubjectArgs,
} from "../actions/updateGradedSubject";
import type { GradedSubject } from "@/server/db/types";

interface Context {
  previous?: GradedSubject[];
}

export function useUpdateGradedSubject(classId: string) {
  const qc = useQueryClient();
  const key = ["graded_subjects", classId] as const;

  return useMutation<string, unknown, UpdateGradedSubjectArgs, Context>({
    mutationFn: (args) => updateGradedSubject(args),

    onMutate: (args) => {
      void qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<GradedSubject[]>(key);

      qc.setQueryData<GradedSubject[]>(key, (old = []) =>
        old.map((s) =>
          s.id === args.id
            ? {
                ...s,
                name: args.name,
                default_grade_scale: args.default_grade_scale,
                graded_assignment_ids: args.graded_assignment_ids,
                section_ids: args.section_ids,
              }
            : s,
        ),
      );

      return { previous };
    },

    onError: (_err, _vars, ctx) => {
      toast.error("Failed to update subject.");
      if (ctx?.previous) {
        qc.setQueryData(key, ctx.previous);
      }
    },

    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
    },
  });
}
