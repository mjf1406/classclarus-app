import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import type { GradedSubjectListItem } from "@/lib/gradedSubjects/gradedSubjects";
import { GC_TIME } from "@/lib/queryCache";

export function gradedSubjectsListQueryKey(classId: Id<"classes">) {
  return convexQuery(api.gradedSubjects.listForClass, { classId }).queryKey;
}

/** gcTime: GC_TIME.realtime — subjects change rarely; reactive via Convex. */
export function useGradedSubjects(classId: Id<"classes">) {
  return useAuthedQuery(api.gradedSubjects.listForClass, { classId }, { gcTime: GC_TIME.realtime });
}

export type GradedSubjectList = GradedSubjectListItem[];

export function gradedSubjectDetailQueryKey(
  classId: Id<"classes">,
  gradedSubjectId: Id<"gradedSubjects">,
) {
  return convexQuery(api.gradedSubjects.get, { classId, gradedSubjectId }).queryKey;
}

/** gcTime: GC_TIME.realtime — edit page detail. */
export function useGradedSubject(
  classId: Id<"classes">,
  gradedSubjectId: Id<"gradedSubjects"> | undefined,
) {
  return useAuthedQuery(
    api.gradedSubjects.get,
    gradedSubjectId ? { classId, gradedSubjectId } : "skip",
    { gcTime: GC_TIME.realtime },
  );
}
