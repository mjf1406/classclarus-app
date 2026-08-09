import { convexQuery } from "@convex-dev/react-query";

import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";
import { api } from "../../../convex/_generated/api";

export function razAssessmentsQueryKey(classId: Id<"classes">) {
  return convexQuery(api.raz.listAssessments, { classId }).queryKey;
}

/** gcTime: 1 hour — reactive via Convex; matches RAZ levels / roster. */
export function useRazAssessments(classId: Id<"classes">) {
  return useAuthedQuery(api.raz.listAssessments, { classId }, { gcTime: ONE_HOUR });
}
