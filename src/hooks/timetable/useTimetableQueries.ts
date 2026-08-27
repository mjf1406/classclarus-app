import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";

export function timetableTermsQueryKey(classId: Id<"classes">) {
  return convexQuery(api.timetable.listTerms, { classId }).queryKey;
}

export function timetableWeekBundleQueryKey(
  classId: Id<"classes">,
  termId: Id<"timetableTerms">,
  year: number,
  weekNumber: number,
) {
  return convexQuery(api.timetable.getWeekBundle, {
    classId,
    termId,
    year,
    weekNumber,
  }).queryKey;
}

export function useTimetableTerms(classId: Id<"classes">) {
  return useAuthedQuery(api.timetable.listTerms, { classId }, { gcTime: ONE_HOUR });
}

export function useTimetableWeekBundle(
  classId: Id<"classes">,
  termId: Id<"timetableTerms"> | undefined,
  year: number,
  weekNumber: number,
) {
  return useAuthedQuery(
    api.timetable.getWeekBundle,
    termId ? { classId, termId, year, weekNumber } : "skip",
    { gcTime: ONE_HOUR },
  );
}
