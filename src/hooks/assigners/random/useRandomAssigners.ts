import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";
import type { RandomAssignerListItem } from "@/lib/assigners/randomAssigners";

export function randomAssignersListQueryKey(classId: Id<"classes">) {
  return convexQuery(api.randomAssigners.listForClass, { classId }).queryKey;
}

/** gcTime: ONE_HOUR — assigners change rarely; reactive via Convex. */
export function useRandomAssigners(classId: Id<"classes">) {
  return useAuthedQuery(api.randomAssigners.listForClass, { classId }, { gcTime: ONE_HOUR });
}

export type RandomAssignerList = RandomAssignerListItem[];

export function randomAssignerDetailQueryKey(
  classId: Id<"classes">,
  assignerId: Id<"randomAssigners">,
) {
  return convexQuery(api.randomAssigners.get, { classId, assignerId }).queryKey;
}

/** gcTime: ONE_HOUR — edit page detail. */
export function useRandomAssigner(
  classId: Id<"classes">,
  assignerId: Id<"randomAssigners"> | undefined,
) {
  return useAuthedQuery(api.randomAssigners.get, assignerId ? { classId, assignerId } : "skip", {
    gcTime: ONE_HOUR,
  });
}

export function randomAssignerRunsQueryKey(
  classId: Id<"classes">,
  assignerId: Id<"randomAssigners">,
) {
  return convexQuery(api.randomAssigners.listRuns, { classId, assignerId }).queryKey;
}

/** gcTime: ONE_HOUR — run history. */
export function useRandomAssignerRuns(
  classId: Id<"classes">,
  assignerId: Id<"randomAssigners"> | undefined,
) {
  return useAuthedQuery(
    api.randomAssigners.listRuns,
    assignerId ? { classId, assignerId } : "skip",
    { gcTime: ONE_HOUR },
  );
}

export function randomAssignerRunQueryKey(
  classId: Id<"classes">,
  assignerId: Id<"randomAssigners">,
  runId: Id<"randomAssignerRuns">,
) {
  return convexQuery(api.randomAssigners.getRun, { classId, assignerId, runId }).queryKey;
}

/** gcTime: ONE_HOUR — print detail (class-scoped). */
export function useRandomAssignerRun(
  classId: Id<"classes">,
  assignerId: Id<"randomAssigners"> | undefined,
  runId: Id<"randomAssignerRuns"> | undefined,
) {
  return useAuthedQuery(
    api.randomAssigners.getRun,
    assignerId && runId ? { classId, assignerId, runId } : "skip",
    { gcTime: ONE_HOUR },
  );
}

export function randomAssignerRunByIdQueryKey(runId: Id<"randomAssignerRuns">) {
  return convexQuery(api.randomAssigners.getRunById, { runId }).queryKey;
}

/** gcTime: ONE_HOUR — fullscreen display at `/d/$runId`. */
export function useRandomAssignerRunById(runId: Id<"randomAssignerRuns"> | undefined) {
  return useAuthedQuery(api.randomAssigners.getRunById, runId ? { runId } : "skip", {
    gcTime: ONE_HOUR,
  });
}
