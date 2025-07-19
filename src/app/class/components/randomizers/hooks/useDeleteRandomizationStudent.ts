// src/app/class/components/randomizations/hooks/useDeleteRandomizationStudent.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteRandomizationStudent } from "../actions/deleteRandomizationStudent";
import type { RandomizationStudent } from "@/server/db/schema";

// Assuming you have a type that combines randomization with students
interface RandomizationWithStudents {
  id: string;
  user_id: string;
  class_id: string;
  name: string;
  created_date: string;
  updated_date: string;
  students: RandomizationStudent[];
}

interface Context {
  previous?: RandomizationWithStudents[];
}

export function useDeleteRandomizationStudent(
  classId: string,
  randomizationId: string,
) {
  const queryClient = useQueryClient();
  const qKey = ["randomizations", classId] as const;

  return useMutation<void, unknown, string, Context>({
    mutationFn: (id) => deleteRandomizationStudent(id),

    onMutate: (id) => {
      void queryClient.cancelQueries({ queryKey: qKey });
      const previous =
        queryClient.getQueryData<RandomizationWithStudents[]>(qKey) ?? [];

      const next = previous.map((r) =>
        r.id === randomizationId
          ? {
              ...r,
              students: r.students.filter((s) => s.id !== id),
            }
          : r,
      );

      queryClient.setQueryData<RandomizationWithStudents[]>(qKey, next);
      return { previous };
    },

    onError: (_err, _id, ctx) => {
      toast.error("Error removing student. Please try again.");
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
