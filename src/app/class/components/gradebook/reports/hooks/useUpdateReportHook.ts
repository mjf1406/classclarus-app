// src/app/class/components/reports/hooks/useUpdateReport.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateReport, type UpdateReportArgs } from "../actions/updateReport";
import { toast } from "sonner";
import { type Report } from "@/server/db/types";

interface Context {
  previous?: Report[];
}

export function useUpdateReport(classId: string) {
  const queryClient = useQueryClient();
  const qKey = ["reports", classId] as const;

  return useMutation<string, unknown, UpdateReportArgs, Context>({
    mutationFn: (args) => updateReport(args),
    onMutate: (args) => {
      void queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<Report[]>(qKey) ?? [];
      const prevItem = previous.find((r) => r.id === args.id);

      const updated: Report = {
        id: args.id,
        user_id: prevItem?.user_id ?? "",
        class_id: args.class_id,
        name: args.name ?? prevItem?.name ?? "",
        graded_subjects:
          args.graded_subjects ?? prevItem?.graded_subjects ?? [],
      };

      queryClient.setQueryData<Report[]>(qKey, (old = []) =>
        old.map((r) => (r.id === args.id ? updated : r)),
      );

      return { previous };
    },
    onError: (_err, _args, ctx) => {
      toast.error("Error updating report. Please try again.");
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
