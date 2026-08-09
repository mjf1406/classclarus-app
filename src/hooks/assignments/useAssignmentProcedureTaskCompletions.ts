import { convexQuery } from "@convex-dev/react-query";
import type { FunctionReturnType } from "convex/server";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { FIVE_MINUTES } from "@/lib/queryCache";

export type AssignmentProcedureTaskCompletions = NonNullable<
  FunctionReturnType<typeof api.assignments.getProcedureTaskCompletions>
>;

export function assignmentProcedureTaskCompletionsQueryKey(
  classId: Id<"classes">,
  assignmentId: Id<"assignments">,
) {
  return convexQuery(api.assignments.getProcedureTaskCompletions, {
    classId,
    assignmentId,
  }).queryKey;
}

/** gcTime: 5 minutes — reactive via Convex; moderate cache after unmount. */
export function useAssignmentProcedureTaskCompletions(
  classId: Id<"classes">,
  assignmentId: Id<"assignments">,
) {
  return useAuthedQuery(
    api.assignments.getProcedureTaskCompletions,
    { classId, assignmentId },
    { gcTime: FIVE_MINUTES },
  );
}
