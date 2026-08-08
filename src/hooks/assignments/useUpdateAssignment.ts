import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { assignmentDetailQueryKey } from "@/hooks/assignments/useAssignment";
import { assignmentsListQueryKey } from "@/hooks/assignments/useAssignments";
import { tasksListQueryKey } from "@/hooks/tasks/useTasks";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type {
  AssignmentDetail,
  AssignmentList,
  AssignmentMutationPayload,
} from "@/lib/assignments/assignments";
import { messageFromError } from "@/lib/errors/convexError";

type UpdateAssignmentArgs = AssignmentMutationPayload & {
  classId: Id<"classes">;
  assignmentId: Id<"assignments">;
};

export function useUpdateAssignment() {
  const { t } = useTranslation("assignments");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.assignments.update);

  return useOptimisticMutation({
    mutationFn: (args: UpdateAssignmentArgs) => mutationFn(args),
    queryKeys: (args) => [
      assignmentsListQueryKey(args.classId),
      assignmentDetailQueryKey(args.classId, args.assignmentId),
    ],
    invalidateQueryKeys: (args) => [tasksListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      const listKey = assignmentsListQueryKey(args.classId);
      const detailKey = assignmentDetailQueryKey(args.classId, args.assignmentId);
      const hasInstructions = Boolean(args.instructionsJson);
      const hasProcedure = args.procedureSteps.length > 0;

      queryClient.setQueryData<AssignmentList>(listKey, (old) => {
        if (!old) return old;
        return old.map((item) =>
          item._id === args.assignmentId
            ? {
                ...item,
                name: args.name,
                subject: args.subject,
                unit: args.unit,
                dueDateKey: args.dueDateKey,
                instructionsJson: args.instructionsJson,
                scoringMode: args.scoringMode,
                totalPoints: args.totalPoints,
                sections: args.sections,
                procedureSteps: args.procedureSteps,
                expectationIds: args.expectationIds,
                hasInstructions,
                hasProcedure,
                updatedAt: now,
              }
            : item,
        );
      });

      queryClient.setQueryData<AssignmentDetail | null>(detailKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          name: args.name,
          subject: args.subject,
          unit: args.unit,
          dueDateKey: args.dueDateKey,
          instructionsJson: args.instructionsJson,
          scoringMode: args.scoringMode,
          totalPoints: args.totalPoints,
          sections: args.sections,
          procedureSteps: args.procedureSteps,
          expectationIds: args.expectationIds,
          updatedAt: now,
        };
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("saveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
