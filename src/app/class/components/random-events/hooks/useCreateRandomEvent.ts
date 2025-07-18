// src/app/class/components/random-events/hooks/useCreateRandomEvent.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { v4 as uuidV4 } from "uuid";
import {
  createRandomEvent,
  type CreateRandomEventArgs,
} from "../actions/createRandomEvent";
import type { RandomEvent } from "@/server/db/schema";
import { tursoDateTime } from "@/lib/utils";

interface Context {
  previous?: RandomEvent[];
}

export function useCreateRandomEvent(classId: string) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  if (!userId) throw new Error("User ID is null");

  const qKey = ["random_events", classId] as const;

  return useMutation<string, unknown, CreateRandomEventArgs, Context>({
    mutationFn: (args) => createRandomEvent(args),

    onMutate: (args) => {
      void queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<RandomEvent[]>(qKey) ?? [];

      const id = uuidV4();
      const optimistic: RandomEvent = {
        id,
        user_id: userId,
        class_id: args.class_id,
        name: args.name,
        description: args.description ?? null,
        image: args.image ?? null,
        icon: args.icon ?? null,
        audio: args.audio ?? null,
        selected: args.selected ?? false,
        created_date: tursoDateTime(),
        updated_date: tursoDateTime(),
        old_files: [],
      };

      queryClient.setQueryData<RandomEvent[]>(qKey, (old = []) => [
        ...old,
        optimistic,
      ]);
      return { previous };
    },

    onError: (_err, _args, ctx) => {
      toast.error("Error creating event. Please try again.");
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
