import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { razInitialLevelsQueryKey } from "@/hooks/raz/useRazInitialLevels";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import type { RazInitialLevelEntry } from "@/lib/raz/levels";
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

/** gcTime: N/A (mutation). Patches levels query (ONE_HOUR). */
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
    queryKeys: (args) => [razInitialLevelsQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = razInitialLevelsQueryKey(args.classId);
      queryClient.setQueryData<RazInitialLevelEntry[]>(key, (old) => {
        if (!old) return old;
        return old.map((row) =>
          row.studentUserId === args.studentUserId ? { ...row, currentLevel: args.level } : row,
        );
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
