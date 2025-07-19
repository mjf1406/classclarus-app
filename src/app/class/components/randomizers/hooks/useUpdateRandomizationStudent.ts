// src/app/class/components/randomizations/hooks/useUpdateRandomizationStudent.ts
"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";
import {
  updateRandomizationStudent,
  type UpdateRandomizationStudentArgs,
} from "../actions/updateRandomizationStudent";
import type { RandomizationStudent } from "@/server/db/schema";

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

export function useUpdateRandomizationStudent(classId: string) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  if (!userId) throw new Error("Not authenticated");

  const qKey = ["randomizations", classId] as const;

  return useMutation<string, unknown, UpdateRandomizationStudentArgs, Context>({
    mutationFn: (args) => updateRandomizationStudent(args),

    onMutate: (args) => {
      void queryClient.cancelQueries({ queryKey: qKey });
      const previous =
        queryClient.getQueryData<RandomizationWithStudents[]>(qKey) ?? [];

      // Optimistically toggle `checked` inline
      const next = previous.map((r) => ({
        ...r,
        students: r.students.map((s) =>
          s.id === args.id ? { ...s, checked: args.checked } : s,
        ),
      }));

      queryClient.setQueryData(qKey, next);
      return { previous };
    },

    onError: (_err, _args, ctx) => {
      toast.error("Error updating. Please try again.");
      if (ctx?.previous) {
        queryClient.setQueryData(qKey, ctx.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qKey });
    },
  });
}
