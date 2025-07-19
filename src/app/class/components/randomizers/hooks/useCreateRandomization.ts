// src/app/class/components/randomizations/hooks/useCreateRandomization.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { v4 as uuidV4 } from "uuid";
import {
  createRandomization,
  type CreateRandomizationArgs,
} from "../actions/createRandomization";
import type { Randomization } from "@/server/db/schema";

interface Context {
  previous?: Randomization[];
}

export function useCreateRandomization(classId: string) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  if (!userId) throw new Error("Not authenticated");

  const qKey = ["randomizations", classId] as const;

  return useMutation<string, unknown, CreateRandomizationArgs, Context>({
    mutationFn: (args) => createRandomization(args),

    onMutate: (args) => {
      void queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<Randomization[]>(qKey) ?? [];

      const id = uuidV4();
      const now = new Date().toISOString();
      const optimistic: Randomization = {
        id,
        user_id: userId,
        class_id: args.class_id,
        name: args.name,
        created_date: now,
        updated_date: now,
      };

      queryClient.setQueryData<Randomization[]>(qKey, (old = []) => [
        ...old,
        optimistic,
      ]);
      return { previous };
    },

    onError: (_err, _args, ctx) => {
      toast.error("Error creating randomization. Please try again.");
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
