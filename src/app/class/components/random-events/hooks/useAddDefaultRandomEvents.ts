"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { v4 as uuidV4 } from "uuid";
import { addDefaultRandomEvents } from "../actions/addDefaultRandomEvents";
import type { CreateRandomEventArgs } from "../actions/createRandomEvent";
import type { RandomEvent } from "@/server/db/schema";

// strip out class_id since we supply it in the hook
type DefaultEvent = Omit<CreateRandomEventArgs, "class_id">;

interface Context {
  previous?: RandomEvent[];
}

export function useAddDefaultRandomEvents(classId: string) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  if (!userId) throw new Error("User ID is null");

  const queryKey = ["random_events", classId] as const;

  return useMutation<void, unknown, DefaultEvent[], Context>({
    // call your server‐action
    mutationFn: (events) => addDefaultRandomEvents(classId, events),

    onMutate: (events) => {
      // cancel any in-flight fetches
      void queryClient.cancelQueries({ queryKey });

      // snapshot previous data
      const previous = queryClient.getQueryData<RandomEvent[]>(queryKey) ?? [];

      // build optimistic items
      const now = new Date().toISOString();
      const optimistic: RandomEvent[] = events.map((evt) => ({
        id: uuidV4(),
        user_id: userId,
        class_id: classId,
        name: evt.name,
        description: evt.description ?? null,
        image: evt.image ?? null,
        audio: evt.audio ?? null,
        icon: evt.icon ?? null,
        selected: evt.selected,
        created_date: now,
        updated_date: now,
      }));

      // update cache
      queryClient.setQueryData<RandomEvent[]>(queryKey, (old = []) => [
        ...old,
        ...optimistic,
      ]);

      return { previous };
    },

    onError: (err, _events, ctx) => {
      toast.error("Failed to add default events");
      console.error(err);
      // rollback
      if (ctx?.previous) {
        queryClient.setQueryData(queryKey, ctx.previous);
      }
    },

    onSettled: () => {
      // refetch to reconcile
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}
