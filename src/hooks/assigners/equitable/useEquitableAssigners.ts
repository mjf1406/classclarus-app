import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import type { EquitableAssignerListItem } from "@/lib/assigners/equitableAssigners";
import { GC_TIME } from "@/lib/queryCache";

export function equitableAssignersListQueryKey(classId: Id<"classes">) {
  return convexQuery(api.equitableAssigners.listForClass, { classId }).queryKey;
}

/** gcTime: GC_TIME.realtime — assigners change rarely; reactive via Convex. */
export function useEquitableAssigners(classId: Id<"classes">) {
  return useAuthedQuery(
    api.equitableAssigners.listForClass,
    { classId },
    { gcTime: GC_TIME.realtime },
  );
}

export type EquitableAssignerList = EquitableAssignerListItem[];

export function equitableAssignerDetailQueryKey(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners">,
) {
  return convexQuery(api.equitableAssigners.get, { classId, assignerId }).queryKey;
}

/** gcTime: GC_TIME.realtime — edit page detail. */
export function useEquitableAssigner(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners"> | undefined,
) {
  return useAuthedQuery(api.equitableAssigners.get, assignerId ? { classId, assignerId } : "skip", {
    gcTime: GC_TIME.realtime,
  });
}

export function equitableAssignerRunsQueryKey(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners">,
) {
  return convexQuery(api.equitableAssigners.listRuns, { classId, assignerId }).queryKey;
}

/** gcTime: GC_TIME.realtime — run history. */
export function useEquitableAssignerRuns(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners"> | undefined,
) {
  return useAuthedQuery(
    api.equitableAssigners.listRuns,
    assignerId ? { classId, assignerId } : "skip",
    { gcTime: GC_TIME.realtime },
  );
}

export function equitableAssignerRunQueryKey(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners">,
  runId: Id<"equitableAssignerRuns">,
) {
  return convexQuery(api.equitableAssigners.getRun, { classId, assignerId, runId }).queryKey;
}

/** gcTime: GC_TIME.realtime — print detail (class-scoped). */
export function useEquitableAssignerRun(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners"> | undefined,
  runId: Id<"equitableAssignerRuns"> | undefined,
) {
  return useAuthedQuery(
    api.equitableAssigners.getRun,
    assignerId && runId ? { classId, assignerId, runId } : "skip",
    { gcTime: GC_TIME.realtime },
  );
}

export function equitableAssignerRunByIdQueryKey(runId: Id<"equitableAssignerRuns">) {
  return convexQuery(api.equitableAssigners.getRunById, { runId }).queryKey;
}

/** gcTime: GC_TIME.realtime — fullscreen display at `/de/$runId`. */
export function useEquitableAssignerRunById(runId: Id<"equitableAssignerRuns"> | undefined) {
  return useAuthedQuery(api.equitableAssigners.getRunById, runId ? { runId } : "skip", {
    gcTime: GC_TIME.realtime,
  });
}
