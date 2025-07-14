// src/app/class/components/reports/subject-comments/hooks/useUpdateSubjectComment.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";
import { v4 as uuidV4 } from "uuid";
import type { SubjectComment } from "@/server/db/schema";
import {
  updateSubjectComment,
  type UpdateSubjectCommentArgs,
} from "../actions/updateSubjectComments";

interface Context {
  previous?: SubjectComment[];
}

export function useUpdateSubjectComment(reportId: string) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  if (!userId) throw new Error("Not authenticated");

  const qKey = ["subject_comments", userId] as const;

  return useMutation<string, unknown, UpdateSubjectCommentArgs, Context>({
    mutationFn: (args) =>
      updateSubjectComment({ ...args, report_id: reportId }),

    onMutate: (args) => {
      void queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<SubjectComment[]>(qKey) ?? [];

      const now = new Date().toISOString();
      const id = args.id ?? uuidV4();
      const existing = previous.find((c) => c.id === id);

      const optimistic: SubjectComment = {
        id,
        user_id: userId,
        report_id: reportId,
        comments: args.comments,
        created_date: existing?.created_date ?? now,
        updated_date: now,
      };

      const next = existing
        ? previous.map((c) => (c.id === id ? optimistic : c))
        : [...previous, optimistic];

      queryClient.setQueryData<SubjectComment[]>(qKey, next);
      return { previous };
    },

    onError: (_err, _args, ctx) => {
      toast.error("Error saving comment. Please try again.");
      console.error(_err);
      if (ctx?.previous) {
        queryClient.setQueryData(qKey, ctx.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qKey });
      toast.success("Subject Comments uploaded successfully!");
    },
  });
}
