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

type SetAssignmentReleasedArgs = {
  classId: Id<"classes">;
  assignmentId: Id<"assignments">;
  released: boolean;
  scheduledReleaseAt?: number;
};

export function useSetAssignmentReleased() {
  const { t } = useTranslation("assignments");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.assignments.setReleased);

  return useOptimisticMutation({
    mutationFn: (args: SetAssignmentReleasedArgs) => mutationFn(args),
    queryKeys: (args) => [
      assignmentsListQueryKey(args.classId),
      assignmentDetailQueryKey(args.classId, args.assignmentId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      const hiddenFromStudents = !args.released || args.scheduledReleaseAt !== undefined;
      const patch = {
        hiddenFromStudents,
        scheduledReleaseAt: args.released ? undefined : args.scheduledReleaseAt,
        updatedAt: now,
      };
      queryClient.setQueryData<AssignmentList>(assignmentsListQueryKey(args.classId), (old) => {
        if (!old) return old;
        return old.map((item) => (item._id === args.assignmentId ? { ...item, ...patch } : item));
      });
      queryClient.setQueryData<AssignmentDetail | null>(
        assignmentDetailQueryKey(args.classId, args.assignmentId),
        (old) => (old ? { ...old, ...patch } : old),
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("releaseFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
