import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import {
  gradedSubjectsListQueryKey,
  type GradedSubjectList,
} from "@/hooks/gradedSubjects/useGradedSubjects";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { GradedSubjectFormValues } from "@/lib/gradedSubjects/gradedSubjects";
import { gradedSubjectMutationPayloadFromForm } from "@/lib/gradedSubjects/gradedSubjects";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

type CreateGradedSubjectArgs = {
  classId: Id<"classes">;
  values: GradedSubjectFormValues;
};

export function useCreateGradedSubject() {
  const { t } = useTranslation("studentWork");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.gradedSubjects.create);

  return useOptimisticMutation({
    mutationFn: (args: CreateGradedSubjectArgs) => {
      const payload = gradedSubjectMutationPayloadFromForm(args.values);
      return mutationFn({
        classId: args.classId,
        ...payload,
      });
    },
    queryKeys: (args) => [gradedSubjectsListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = gradedSubjectsListQueryKey(args.classId);
      const payload = gradedSubjectMutationPayloadFromForm(args.values);
      const now = Date.now();
      const optimisticId = `optimistic:${randomClientId()}` as Id<"gradedSubjects">;

      queryClient.setQueryData<GradedSubjectList>(key, (old) => {
        const next = {
          _id: optimisticId,
          _creationTime: now,
          name: payload.name,
          icon: payload.icon,
          gradeScaleId: payload.gradeScaleId,
          items: payload.items,
          createdBy: `optimistic:${randomClientId()}` as Id<"users">,
          createdAt: now,
          updatedAt: now,
        };
        if (!old) return [next];
        return [...old, next];
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("subjectSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
