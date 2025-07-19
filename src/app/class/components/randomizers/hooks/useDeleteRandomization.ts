// src/app/class/components/randomizations/hooks/useDeleteRandomization.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteRandomization } from "../actions/deleteRandomization";
import type { Randomization } from "@/server/db/schema";

interface Context {
  previous?: Randomization[];
}

export function useDeleteRandomization(classId: string) {
  const queryClient = useQueryClient();
  const qKey = ["randomizations", classId] as const;

  return useMutation<void, unknown, string, Context>({
    mutationFn: (id) => deleteRandomization(id),

    onMutate: (id) => {
      void queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<Randomization[]>(qKey) ?? [];
      queryClient.setQueryData<Randomization[]>(qKey, (old = []) =>
        old.filter((r) => r.id !== id),
      );
      return { previous };
    },

    onError: (_err, _id, ctx) => {
      toast.error("Error deleting randomization. Please try again.");
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
