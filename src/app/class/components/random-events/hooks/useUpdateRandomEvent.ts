// src/app/class/components/random-events/hooks/useUpdateRandomEvent.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateRandomEvent,
  type UpdateRandomEventArgs,
} from "../actions/updateRandomEvent";
import { toast } from "sonner";
import type { RandomEvent } from "@/server/db/schema";

interface Context {
  previous?: RandomEvent[];
}

export function useUpdateRandomEvent(classId: string) {
  const queryClient = useQueryClient();
  const qKey = ["random_events", classId] as const;

  return useMutation<string, unknown, UpdateRandomEventArgs, Context>({
    mutationFn: (args) => updateRandomEvent(args),

    onMutate: (args) => {
      void queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<RandomEvent[]>(qKey) ?? [];
      const prev = previous.find((e) => e.id === args.id);
      if (!prev) return { previous };

      const updated: RandomEvent = {
        ...prev,
        name: args.name ?? prev.name,
        description: args.description ?? prev.description,
        image: args.image ?? prev.image,
        icon: args.icon ?? prev.icon,
        selected: args.selected ?? prev.selected,
        updated_date: new Date().toISOString(),
      };

      queryClient.setQueryData<RandomEvent[]>(qKey, (old = []) =>
        old.map((e) => (e.id === args.id ? updated : e)),
      );
      return { previous };
    },

    onError: (_err, _args, ctx) => {
      toast.error("Error updating event. Please try again.");
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
