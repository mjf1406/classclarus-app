// src/app/class/components/reports/hooks/useCreateReport.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { v4 as uuidV4 } from "uuid";
import { createReport, type CreateReportArgs } from "../actions/createReport";
import { type Report } from "@/server/db/types";

interface Context {
  previous?: Report[];
}

export function useCreateReport(classId: string) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  if (!userId) throw new Error("User ID is null");

  const qKey = ["reports", classId] as const;

  return useMutation<string, unknown, CreateReportArgs, Context>({
    mutationFn: (args) => createReport(args),
    onMutate: (args) => {
      void queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<Report[]>(qKey) ?? [];

      const optimistic: Report = {
        id: uuidV4(),
        user_id: userId,
        class_id: args.class_id,
        name: args.name,
        graded_subjects: args.graded_subjects ?? [],
      };

      queryClient.setQueryData<Report[]>(qKey, (old = []) => [
        ...old,
        optimistic,
      ]);

      return { previous };
    },
    onError: (_err, _args, ctx) => {
      toast.error("Error creating report. Please try again.");
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
