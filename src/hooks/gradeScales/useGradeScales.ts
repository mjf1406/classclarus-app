import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import type { GradeScaleListItem } from "@/lib/gradeScales/gradeScales";
import { GC_TIME } from "@/lib/queryCache";

export function gradeScalesListQueryKey(classId: Id<"classes">) {
  return convexQuery(api.gradeScales.listForClass, { classId }).queryKey;
}

/** gcTime: GC_TIME.realtime — scales change rarely; reactive via Convex. */
export function useGradeScales(classId: Id<"classes">) {
  return useAuthedQuery(api.gradeScales.listForClass, { classId }, { gcTime: GC_TIME.realtime });
}

export type GradeScaleList = GradeScaleListItem[];
