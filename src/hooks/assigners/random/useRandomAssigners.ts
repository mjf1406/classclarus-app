import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import type { RandomAssignerListItem } from "@/lib/assigners/randomAssigners";
import { GC_TIME } from "@/lib/queryCache";

export function randomAssignersListQueryKey(classId: Id<"classes">) {
  return convexQuery(api.randomAssigners.listForClass, { classId }).queryKey;
}

/** gcTime: GC_TIME.realtime — assigners change rarely; reactive via Convex. */
export function useRandomAssigners(classId: Id<"classes">) {
  return useAuthedQuery(
    api.randomAssigners.listForClass,
    { classId },
    { gcTime: GC_TIME.realtime },
  );
}

export type RandomAssignerList = RandomAssignerListItem[];

export function randomAssignerDetailQueryKey(
  classId: Id<"classes">,
  assignerId: Id<"randomAssigners">,
) {
  return convexQuery(api.randomAssigners.get, { classId, assignerId }).queryKey;
}

/** gcTime: GC_TIME.realtime — edit page detail. */
export function useRandomAssigner(
  classId: Id<"classes">,
  assignerId: Id<"randomAssigners"> | undefined,
) {
  return useAuthedQuery(api.randomAssigners.get, assignerId ? { classId, assignerId } : "skip", {
    gcTime: GC_TIME.realtime,
  });
}

export function randomAssignerRunsQueryKey(
  classId: Id<"classes">,
  assignerId: Id<"randomAssigners">,
) {
  return convexQuery(api.randomAssigners.listRuns, { classId, assignerId }).queryKey;
}

/** gcTime: GC_TIME.realtime — run history. */
export function useRandomAssignerRuns(
  classId: Id<"classes">,
  assignerId: Id<"randomAssigners"> | undefined,
) {
  return useAuthedQuery(
    api.randomAssigners.listRuns,
    assignerId ? { classId, assignerId } : "skip",
    { gcTime: GC_TIME.realtime },
  );
}

export function randomAssignerRunQueryKey(
  classId: Id<"classes">,
  assignerId: Id<"randomAssigners">,
  runId: Id<"randomAssignerRuns">,
) {
  return convexQuery(api.randomAssigners.getRun, { classId, assignerId, runId }).queryKey;
}

/** gcTime: GC_TIME.realtime — print detail (class-scoped). */
export function useRandomAssignerRun(
  classId: Id<"classes">,
  assignerId: Id<"randomAssigners"> | undefined,
  runId: Id<"randomAssignerRuns"> | undefined,
) {
  return useAuthedQuery(
    api.randomAssigners.getRun,
    assignerId && runId ? { classId, assignerId, runId } : "skip",
    { gcTime: GC_TIME.realtime },
  );
}

export function randomAssignerRunByIdQueryKey(runId: Id<"randomAssignerRuns">) {
  return convexQuery(api.randomAssigners.getRunById, { runId }).queryKey;
}

/** gcTime: GC_TIME.realtime — fullscreen display at `/d/$runId`. */
export function useRandomAssignerRunById(runId: Id<"randomAssignerRuns"> | undefined) {
  return useAuthedQuery(api.randomAssigners.getRunById, runId ? { runId } : "skip", {
    gcTime: GC_TIME.realtime,
  });
}
