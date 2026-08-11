import type { Id } from "../../_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "../../_generated/server.js";
import { deskItemsById, type SeatLayoutItemSnapshot } from "../seatChartGeometry.js";
import { resolveTeamIdForStudentDesk } from "../seatChartLogic.js";
import { finishSeatingAlgorithm, prepareSeatingAlgorithmInput } from "./pipeline.js";
import type { GroupMembershipRow } from "./scope.js";
import type { LockedAssignment, SeatingAlgorithmScope, SeatingScopeHint } from "./types.js";
import { normalizeSeatAlgorithmSettings } from "./settings.js";
import type { Doc } from "../../_generated/dataModel.js";

export type PrepareSeatingInputArgs = {
  classId: Id<"classes">;
  layoutId: Id<"seatLayouts">;
  layoutItems: Array<SeatLayoutItemSnapshot>;
  lockedAssignments: ReadonlyArray<LockedAssignment>;
  scope?: SeatingAlgorithmScope;
  scopeHint?: SeatingScopeHint;
  randomSeed: string;
  settings: ReturnType<typeof normalizeSeatAlgorithmSettings>;
  constraints: Array<Doc<"seatConstraints">>;
  memberships: Array<GroupMembershipRow>;
  rosterGenderByStudent: ReadonlyMap<Id<"users">, Doc<"studentRosters">["gender"] | undefined>;
  layoutAggregateRows: Array<
    Pick<Doc<"seatLayoutAggregates">, "studentUserId" | "dimension" | "key" | "count">
  >;
};

export type RunSeatingAlgorithmArgs = PrepareSeatingInputArgs & {
  deskById: Map<string, SeatLayoutItemSnapshot>;
};

export {
  buildSeatingDeskSlots,
  buildSeatingStudents,
  finishSeatingAlgorithm,
  prepareSeatingAlgorithmInput,
} from "./pipeline.js";

/** Server wrapper: resolves team IDs via DB, then runs the pure solver pipeline. */
export async function runSeatingAlgorithm(
  ctx: QueryCtx | MutationCtx,
  args: RunSeatingAlgorithmArgs,
): Promise<ReturnType<typeof finishSeatingAlgorithm>> {
  const teamIdCache = new Map<string, Id<"teams"> | undefined>();
  const groupIds = [...new Set(args.memberships.map((row) => row.groupId))];
  for (const desk of deskItemsById(args.layoutItems).values()) {
    for (const groupId of groupIds) {
      const cacheKey = `${groupId}:${desk.id}`;
      if (teamIdCache.has(cacheKey)) continue;
      teamIdCache.set(cacheKey, await resolveTeamIdForStudentDesk(ctx, groupId, desk));
    }
  }

  const input = prepareSeatingAlgorithmInput({
    ...args,
    resolveTeamId: (groupId, desk) => teamIdCache.get(`${groupId}:${desk.id}`),
  });

  return finishSeatingAlgorithm({
    input,
    lockedAssignments: args.lockedAssignments,
    memberships: args.memberships,
    deskById: args.deskById,
  });
}

export { slotKey } from "../seatChartGeometry.js";
