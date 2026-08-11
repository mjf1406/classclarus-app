import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";
import type { GradeScaleListItem } from "@/lib/gradeScales/gradeScales";

export function gradeScalesListQueryKey(classId: Id<"classes">) {
  return convexQuery(api.gradeScales.listForClass, { classId }).queryKey;
}

/** gcTime: ONE_HOUR — scales change rarely; reactive via Convex. */
export function useGradeScales(classId: Id<"classes">) {
  return useAuthedQuery(api.gradeScales.listForClass, { classId }, { gcTime: ONE_HOUR });
}

export type GradeScaleList = GradeScaleListItem[];
