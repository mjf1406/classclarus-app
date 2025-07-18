// src/app/class/components/random-events/hooks/useDeleteRandomEvent.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteRandomEvent } from "../actions/deleteRandomEvent";
import type { RandomEvent } from "@/server/db/schema";

interface Context {
  previous?: RandomEvent[];
}

export function useDeleteRandomEvent(classId: string) {
  const queryClient = useQueryClient();
  const qKey = ["random_events", classId] as const;

  return useMutation<void, unknown, string, Context>({
    mutationFn: (id) => deleteRandomEvent(id),

    onMutate: (id) => {
      void queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<RandomEvent[]>(qKey) ?? [];
      queryClient.setQueryData<RandomEvent[]>(qKey, (old = []) =>
        old.filter((e) => e.id !== id),
      );
      return { previous };
    },

    onError: (_err, _id, ctx) => {
      toast.error("Error deleting event. Please try again.");
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
