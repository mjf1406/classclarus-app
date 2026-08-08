import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { assignmentDetailQueryKey } from "@/hooks/assignments/useAssignment";
import { assignmentsListQueryKey } from "@/hooks/assignments/useAssignments";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { AssignmentDetail, AssignmentList } from "@/lib/assignments/assignments";
import { messageFromError } from "@/lib/errors/convexError";

type SetAssignmentScoresReleasedArgs = {
  classId: Id<"classes">;
  assignmentId: Id<"assignments">;
  released: boolean;
};

export function useSetAssignmentScoresReleased() {
  const { t } = useTranslation("assignments");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.assignmentScores.setScoresReleased);

  return useOptimisticMutation({
    mutationFn: (args: SetAssignmentScoresReleasedArgs) => mutationFn(args),
    queryKeys: (args) => [
      assignmentDetailQueryKey(args.classId, args.assignmentId),
      assignmentsListQueryKey(args.classId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      const detailKey = assignmentDetailQueryKey(args.classId, args.assignmentId);
      const listKey = assignmentsListQueryKey(args.classId);

      queryClient.setQueryData<AssignmentDetail | null>(detailKey, (old) => {
        if (!old) return old;
        return { ...old, scoresReleased: args.released, updatedAt: now };
      });

      queryClient.setQueryData<AssignmentList>(listKey, (old) => {
        if (!old) return old;
        return old.map((item) =>
          item._id === args.assignmentId
            ? { ...item, scoresReleased: args.released, updatedAt: now }
            : item,
        );
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("scoresReleaseFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
