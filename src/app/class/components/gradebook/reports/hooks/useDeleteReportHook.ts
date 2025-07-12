// src/app/class/components/reports/hooks/useDeleteReport.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteReport } from "../actions/deleteReport";
import { type Report } from "@/server/db/types";

interface Context {
  previous?: Report[];
}

export function useDeleteReport(classId: string) {
  const queryClient = useQueryClient();
  const qKey = ["reports", classId] as const;

  return useMutation<void, unknown, string, Context>({
    mutationFn: (id) => deleteReport(id),
    onMutate: (id) => {
      void queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<Report[]>(qKey) ?? [];
      queryClient.setQueryData<Report[]>(qKey, (old = []) =>
        old.filter((r) => r.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      toast.error("Error deleting report. Please try again.");
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
