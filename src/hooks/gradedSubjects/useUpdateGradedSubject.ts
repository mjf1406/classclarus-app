import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { gradeScalesListQueryKey, type GradeScaleList } from "@/hooks/gradeScales/useGradeScales";
import {
  gradedSubjectDetailQueryKey,
  gradedSubjectsListQueryKey,
  type GradedSubjectList,
} from "@/hooks/gradedSubjects/useGradedSubjects";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { GradedSubjectFormValues } from "@/lib/gradedSubjects/gradedSubjects";
import { gradedSubjectMutationPayloadFromForm } from "@/lib/gradedSubjects/gradedSubjects";
import { messageFromError } from "@/lib/errors/convexError";

type UpdateGradedSubjectArgs = {
  classId: Id<"classes">;
  gradedSubjectId: Id<"gradedSubjects">;
  values: GradedSubjectFormValues;
};

function gradeScaleSummaryFromCache(
  scales: GradeScaleList | undefined,
  gradeScaleId: Id<"gradeScales">,
  fallback?: GradedSubjectList[number]["gradeScale"],
) {
  const scale = scales?.find((row) => row._id === gradeScaleId);
  if (!scale) {
    return fallback ?? { isSystem: false as const };
  }
  return {
    isSystem: scale.isSystem,
    name: scale.name,
    nameKey: scale.nameKey,
  };
}

export function useUpdateGradedSubject() {
  const { t } = useTranslation("studentWork");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.gradedSubjects.update);

  return useOptimisticMutation({
    mutationFn: (args: UpdateGradedSubjectArgs) => {
      const payload = gradedSubjectMutationPayloadFromForm(args.values);
      return mutationFn({
        classId: args.classId,
        gradedSubjectId: args.gradedSubjectId,
        ...payload,
      });
    },
    queryKeys: (args) => [
      gradedSubjectsListQueryKey(args.classId),
      gradedSubjectDetailQueryKey(args.classId, args.gradedSubjectId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const payload = gradedSubjectMutationPayloadFromForm(args.values);
      const now = Date.now();
      const listKey = gradedSubjectsListQueryKey(args.classId);
      const detailKey = gradedSubjectDetailQueryKey(args.classId, args.gradedSubjectId);
      const scales = queryClient.getQueryData<GradeScaleList>(
        gradeScalesListQueryKey(args.classId),
      );

      queryClient.setQueryData<GradedSubjectList>(listKey, (old) => {
        if (!old) return old;
        return old.map((subject) =>
          subject._id === args.gradedSubjectId
            ? {
                ...subject,
                name: payload.name,
                icon: payload.icon,
                gradeScaleId: payload.gradeScaleId,
                gradeScale: gradeScaleSummaryFromCache(
                  scales,
                  payload.gradeScaleId,
                  subject.gradeScale,
                ),
                items: payload.items,
                updatedAt: now,
              }
            : subject,
        );
      });

      queryClient.setQueryData(detailKey, (old) => {
        if (!old || typeof old !== "object") return old;
        return {
          ...old,
          name: payload.name,
          icon: payload.icon,
          gradeScaleId: payload.gradeScaleId,
          items: payload.items,
          updatedAt: now,
        };
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
