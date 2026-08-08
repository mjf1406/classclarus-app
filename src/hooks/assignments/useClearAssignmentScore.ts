import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { assignmentScoresQueryKey } from "@/hooks/assignments/useAssignmentScores";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { AssignmentScoreList } from "@/lib/assignments/assignmentScores";
import { messageFromError } from "@/lib/errors/convexError";

type ClearAssignmentScoreArgs = {
  classId: Id<"classes">;
  assignmentId: Id<"assignments">;
  studentUserId: Id<"users">;
};

export function useClearAssignmentScore() {
  const { t } = useTranslation("assignments");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.assignmentScores.clearScore);

  return useOptimisticMutation({
    mutationFn: (args: ClearAssignmentScoreArgs) => mutationFn(args),
    queryKeys: (args) => [assignmentScoresQueryKey(args.classId, args.assignmentId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = assignmentScoresQueryKey(args.classId, args.assignmentId);
      queryClient.setQueryData<AssignmentScoreList>(key, (old) =>
        old ? old.filter((row) => row.studentUserId !== args.studentUserId) : old,
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("scoreClearFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
