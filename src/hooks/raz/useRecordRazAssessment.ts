import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { shouldAutoSetRazRti } from "../../../convex/lib/razAutoRti";
import { toast } from "@/components/ui/toast-manager";
import { razAssessmentsQueryKey } from "@/hooks/raz/useRazAssessments";
import { razInitialLevelsQueryKey } from "@/hooks/raz/useRazInitialLevels";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import type { RazAssessmentEntry, RazInitialLevelEntry } from "@/lib/raz/levels";
import type { RazAssessmentResult } from "@/lib/raz/scoreRecommendation";

export type RecordRazAssessmentArgs = {
  classId: Id<"classes">;
  studentUserId: Id<"users">;
  assessedAt: number;
  readAccuracy: number;
  retellScore?: number;
  respondScore: number;
  result: RazAssessmentResult;
  level: string;
  note?: string;
};

/** gcTime: N/A (mutation). Patches levels + assessments queries (ONE_HOUR). */
export function useRecordRazAssessment() {
  const { t } = useTranslation("raz");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.raz.recordAssessment);

  return useOptimisticMutation({
    mutationFn: (args: RecordRazAssessmentArgs) =>
      mutationFn({
        classId: args.classId,
        studentUserId: args.studentUserId,
        assessedAt: args.assessedAt,
        readAccuracy: args.readAccuracy,
        retellScore: args.retellScore,
        respondScore: args.respondScore,
        result: args.result,
        level: args.level,
        note: args.note,
      }),
    queryKeys: (args) => [
      razInitialLevelsQueryKey(args.classId),
      razAssessmentsQueryKey(args.classId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const levelsKey = razInitialLevelsQueryKey(args.classId);
      queryClient.setQueryData<RazInitialLevelEntry[]>(levelsKey, (old) => {
        if (!old) return old;
        return old.map((row) => {
          if (row.studentUserId !== args.studentUserId) return row;
          const autoRti = shouldAutoSetRazRti(args.result, row.lastAssessmentResult);
          return {
            ...row,
            currentLevel: args.level,
            lastAssessedAt: args.assessedAt,
            lastAssessmentResult: args.result,
            scheduleAnchorAt: args.assessedAt,
            manualStatus: autoRti ? "rti" : null,
          };
        });
      });

      const assessmentsKey = razAssessmentsQueryKey(args.classId);
      const optimistic: RazAssessmentEntry = {
        _id: `optimistic-${args.studentUserId}-${args.assessedAt}`,
        studentUserId: args.studentUserId,
        assessedAt: args.assessedAt,
        readAccuracy: args.readAccuracy,
        retellScore: args.retellScore ?? null,
        respondScore: args.respondScore,
        result: args.result,
        level: args.level,
        note: args.note?.trim() ? args.note.trim() : null,
      };
      queryClient.setQueryData<RazAssessmentEntry[]>(assessmentsKey, (old) => {
        if (!old) return [optimistic];
        return [optimistic, ...old].sort((a, b) => b.assessedAt - a.assessedAt);
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("assessmentSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
