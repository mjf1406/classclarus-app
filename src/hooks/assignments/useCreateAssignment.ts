import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { assignmentsListQueryKey } from "@/hooks/assignments/useAssignments";
import { tasksListQueryKey } from "@/hooks/tasks/useTasks";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { AssignmentMutationPayload } from "@/lib/assignments/assignments";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";
import type { AssignmentList } from "@/lib/assignments/assignments";

type CreateAssignmentArgs = AssignmentMutationPayload & {
  classId: Id<"classes">;
};

export function useCreateAssignment() {
  const { t } = useTranslation("assignments");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.assignments.create);

  return useOptimisticMutation({
    mutationFn: (args: CreateAssignmentArgs) => mutationFn(args),
    queryKeys: (args) => [assignmentsListQueryKey(args.classId)],
    invalidateQueryKeys: (args) => [tasksListQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = assignmentsListQueryKey(args.classId);
      const now = Date.now();
      const optimisticId = `optimistic:${randomClientId()}` as Id<"assignments">;
      queryClient.setQueryData<AssignmentList>(queryKey, (old) => {
        const studentCount = old?.[0]?.studentCount ?? 0;
        const next: AssignmentList[number] = {
          _id: optimisticId,
          _creationTime: now,
          classId: args.classId,
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
          createdBy: `optimistic:${randomClientId()}` as Id<"users">,
          createdAt: now,
          updatedAt: now,
          handedInStudentCount: 0,
          studentCount,
          linkCount: 0,
          hasInstructions: Boolean(args.instructionsJson),
          hasProcedure: args.procedureSteps.length > 0,
        };
        if (!old) return [next];
        return [next, ...old];
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
