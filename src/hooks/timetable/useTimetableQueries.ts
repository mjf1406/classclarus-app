import { convexQuery } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { isOptimisticId } from "@/lib/optimistic";
import { GC_TIME } from "@/lib/queryCache";
import { preloadQuery } from "@/lib/routing/routePreload";
import {
  clampDateToTerm,
  parseTimetableSearch,
  type TimetableSearch,
} from "@/lib/timetable/timetableSearch";
import { clampWeekStartToTerm, getYearAndWeekNumber } from "@/lib/timetable/utils";

export function timetableTermsQueryKey(classId: Id<"classes">) {
  return convexQuery(api.timetable.listTerms, { classId }).queryKey;
}

export function timetableTermsQueryOptions(classId: Id<"classes">) {
  return convexQuery(api.timetable.listTerms, { classId });
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

export function timetableWeekBundleQueryOptions(
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
  });
}

/** Preload terms and the default week bundle for timetable intent navigation. */
export async function preloadTimetableRouteData(
  queryClient: QueryClient,
  classId: Id<"classes">,
  search: TimetableSearch,
) {
  const terms = await queryClient.ensureQueryData(timetableTermsQueryOptions(classId));
  const firstTerm = terms?.find((term) => !isOptimisticId(term._id));
  if (!firstTerm) {
    return;
  }

  const { view, currentDate, weekStart: searchWeekStart } = parseTimetableSearch(search);
  const weekStart = clampWeekStartToTerm(
    searchWeekStart,
    firstTerm.startDateKey,
    firstTerm.endDateKey,
  );
  const focusedDate = clampDateToTerm(currentDate, firstTerm.startDateKey, firstTerm.endDateKey);
  const { year, weekNumber } = getYearAndWeekNumber(view === "day" ? focusedDate : weekStart);

  preloadQuery(
    queryClient,
    timetableWeekBundleQueryOptions(classId, firstTerm._id, year, weekNumber),
  );
}

export function useTimetableTerms(classId: Id<"classes"> | undefined) {
  return useAuthedQuery(api.timetable.listTerms, classId ? { classId } : "skip", {
    gcTime: GC_TIME.realtime,
  });
}

export function useTimetableWeekBundle(
  classId: Id<"classes">,
  termId: Id<"timetableTerms"> | undefined,
  year: number,
  weekNumber: number,
) {
  return useAuthedQuery(
    api.timetable.getWeekBundle,
    termId !== undefined && !isOptimisticId(termId)
      ? { classId, termId, year, weekNumber }
      : "skip",
    { gcTime: GC_TIME.realtime },
  );
}

export function timetableTagsQueryKey(classId: Id<"classes">) {
  return convexQuery(api.timetable.listTags, { classId }).queryKey;
}

export function useTimetableTags(classId: Id<"classes"> | undefined) {
  return useAuthedQuery(api.timetable.listTags, classId ? { classId } : "skip", {
    gcTime: GC_TIME.realtime,
  });
}
