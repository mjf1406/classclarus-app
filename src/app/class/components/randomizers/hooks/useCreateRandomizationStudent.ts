// src/app/class/components/randomizations/hooks/useCreateRandomizationStudent.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { v4 as uuidV4 } from "uuid";
import {
  createRandomizationStudent,
  type CreateRandomizationStudentArgs,
} from "../actions/createRandomizationStudent";
import type { RandomizationStudent } from "@/server/db/schema";
import { tursoDateTime } from "@/lib/utils";

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

export function useCreateRandomizationStudent(classId: string) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  if (!userId) throw new Error("Not authenticated");

  const qKey = ["randomizations", classId] as const;

  return useMutation<
    string,
    unknown,
    CreateRandomizationStudentArgs, // Use the full args type
    Context
  >({
    mutationFn: (args) => createRandomizationStudent(args),

    onMutate: (args) => {
      void queryClient.cancelQueries({ queryKey: qKey });
      const previous =
        queryClient.getQueryData<RandomizationWithStudents[]>(qKey) ?? [];
      const dt = tursoDateTime();
      const id = uuidV4();
      const optimisticStudent: RandomizationStudent = {
        id,
        user_id: userId,
        class_id: classId,
        randomization_id: args.randomization_id,
        student_id: args.student_id,
        position: args.position,
        created_date: dt,
        updated_date: dt,
        checked: false,
      };

      const next = previous.map((r) =>
        r.id === args.randomization_id
          ? {
              ...r,
              students: [...r.students, optimisticStudent],
            }
          : r,
      );

      queryClient.setQueryData<RandomizationWithStudents[]>(qKey, next);
      return { previous };
    },

    onError: (_err, _args, ctx) => {
      toast.error("Error adding student. Please try again.");
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
