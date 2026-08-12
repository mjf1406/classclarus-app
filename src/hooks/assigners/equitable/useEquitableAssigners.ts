import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";
import type { EquitableAssignerListItem } from "@/lib/assigners/equitableAssigners";

export function equitableAssignersListQueryKey(classId: Id<"classes">) {
  return convexQuery(api.equitableAssigners.listForClass, { classId }).queryKey;
}

/** gcTime: ONE_HOUR — assigners change rarely; reactive via Convex. */
export function useEquitableAssigners(classId: Id<"classes">) {
  return useAuthedQuery(api.equitableAssigners.listForClass, { classId }, { gcTime: ONE_HOUR });
}

export type EquitableAssignerList = EquitableAssignerListItem[];

export function equitableAssignerDetailQueryKey(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners">,
) {
  return convexQuery(api.equitableAssigners.get, { classId, assignerId }).queryKey;
}

/** gcTime: ONE_HOUR — edit page detail. */
export function useEquitableAssigner(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners"> | undefined,
) {
  return useAuthedQuery(api.equitableAssigners.get, assignerId ? { classId, assignerId } : "skip", {
    gcTime: ONE_HOUR,
  });
}

export function equitableAssignerRunsQueryKey(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners">,
) {
  return convexQuery(api.equitableAssigners.listRuns, { classId, assignerId }).queryKey;
}

/** gcTime: ONE_HOUR — run history. */
export function useEquitableAssignerRuns(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners"> | undefined,
) {
  return useAuthedQuery(
    api.equitableAssigners.listRuns,
    assignerId ? { classId, assignerId } : "skip",
    { gcTime: ONE_HOUR },
  );
}

export function equitableAssignerRunQueryKey(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners">,
  runId: Id<"equitableAssignerRuns">,
) {
  return convexQuery(api.equitableAssigners.getRun, { classId, assignerId, runId }).queryKey;
}

/** gcTime: ONE_HOUR — print detail (class-scoped). */
export function useEquitableAssignerRun(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners"> | undefined,
  runId: Id<"equitableAssignerRuns"> | undefined,
) {
  return useAuthedQuery(
    api.equitableAssigners.getRun,
    assignerId && runId ? { classId, assignerId, runId } : "skip",
    { gcTime: ONE_HOUR },
  );
}

export function equitableAssignerRunByIdQueryKey(runId: Id<"equitableAssignerRuns">) {
  return convexQuery(api.equitableAssigners.getRunById, { runId }).queryKey;
}

/** gcTime: ONE_HOUR — fullscreen display at `/de/$runId`. */
export function useEquitableAssignerRunById(runId: Id<"equitableAssignerRuns"> | undefined) {
  return useAuthedQuery(api.equitableAssigners.getRunById, runId ? { runId } : "skip", {
    gcTime: ONE_HOUR,
  });
}
