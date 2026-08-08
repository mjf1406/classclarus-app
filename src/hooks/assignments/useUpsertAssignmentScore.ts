import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { assignmentScoresQueryKey } from "@/hooks/assignments/useAssignmentScores";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type {
  AssignmentScore,
  AssignmentScoreList,
  UpsertAssignmentScorePayload,
} from "@/lib/assignments/assignmentScores";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

export function useUpsertAssignmentScore() {
  const { t } = useTranslation("assignments");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.assignmentScores.upsertScore);

  return useOptimisticMutation({
    mutationFn: (args: UpsertAssignmentScorePayload) => mutationFn(args),
    queryKeys: (args) => [assignmentScoresQueryKey(args.classId, args.assignmentId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = assignmentScoresQueryKey(args.classId, args.assignmentId);
      const now = Date.now();

      queryClient.setQueryData<AssignmentScoreList>(key, (old) => {
        const before = old ?? [];
        const index = before.findIndex((row) => row.studentUserId === args.studentUserId);

        if (args.clear) {
          if (index < 0) return before;
          return before.filter((_, i) => i !== index);
        }

        const row: AssignmentScore = {
          _id:
            index >= 0
              ? before[index]!._id
              : (`optimistic:${randomClientId()}` as Id<"assignmentScores">),
          _creationTime: index >= 0 ? before[index]!._creationTime : now,
          classId: args.classId,
          assignmentId: args.assignmentId,
          studentUserId: args.studentUserId,
          totalPointsEarned: args.totalPointsEarned,
          sectionScores: args.sectionScores,
          excused: args.excused === true,
          updatedAt: now,
          updatedBy: `optimistic:${randomClientId()}` as Id<"users">,
        };

        if (index < 0) {
          return [...before, row];
        }
        const next = [...before];
        next[index] = row;
        return next;
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("scoreSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
