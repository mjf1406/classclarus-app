import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";
import type { GradedSubjectListItem } from "@/lib/gradedSubjects/gradedSubjects";

export function gradedSubjectsListQueryKey(classId: Id<"classes">) {
  return convexQuery(api.gradedSubjects.listForClass, { classId }).queryKey;
}

/** gcTime: ONE_HOUR — subjects change rarely; reactive via Convex. */
export function useGradedSubjects(classId: Id<"classes">) {
  return useAuthedQuery(api.gradedSubjects.listForClass, { classId }, { gcTime: ONE_HOUR });
}

export type GradedSubjectList = GradedSubjectListItem[];

export function gradedSubjectDetailQueryKey(
  classId: Id<"classes">,
  gradedSubjectId: Id<"gradedSubjects">,
) {
  return convexQuery(api.gradedSubjects.get, { classId, gradedSubjectId }).queryKey;
}

/** gcTime: ONE_HOUR — edit page detail. */
export function useGradedSubject(
  classId: Id<"classes">,
  gradedSubjectId: Id<"gradedSubjects"> | undefined,
) {
  return useAuthedQuery(
    api.gradedSubjects.get,
    gradedSubjectId ? { classId, gradedSubjectId } : "skip",
    { gcTime: ONE_HOUR },
  );
}
