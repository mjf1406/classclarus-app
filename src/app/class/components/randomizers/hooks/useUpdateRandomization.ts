// src/app/class/components/randomizations/hooks/useUpdateRandomization.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  updateRandomization,
  type UpdateRandomizationArgs,
} from "../actions/updateRandomization";
import type { Randomization } from "@/server/db/schema";

interface Context {
  previous?: Randomization[];
}

export function useUpdateRandomization(classId: string) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  if (!userId) throw new Error("Not authenticated");

  const qKey = ["randomizations", classId] as const;

  return useMutation<string, unknown, UpdateRandomizationArgs, Context>({
    mutationFn: (args) => updateRandomization(args),

    onMutate: (args) => {
      void queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<Randomization[]>(qKey) ?? [];
      const prev = previous.find((r) => r.id === args.id);
      if (!prev) return { previous };

      const updated: Randomization = {
        ...prev,
        name: args.name,
        updated_date: new Date().toISOString(),
      };

      queryClient.setQueryData<Randomization[]>(qKey, (old = []) =>
        old.map((r) => (r.id === args.id ? updated : r)),
      );
      return { previous };
    },

    onError: (_err, _args, ctx) => {
      toast.error("Error updating randomization. Please try again.");
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
