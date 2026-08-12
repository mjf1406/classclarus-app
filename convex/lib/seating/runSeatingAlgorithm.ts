import type { Id } from "../../_generated/dataModel.js";
import type { SeatLayoutItemSnapshot } from "./seatChartGeometry.js";
import { finishSeatingAlgorithm, prepareSeatingAlgorithmInput } from "./pipeline.js";
import { teamHistoryKey } from "./historyKeys.js";
import type { GroupMembershipRow } from "./scope.js";
import type {
  GenderParityMode,
  LockedAssignment,
  SeatingAlgorithmScope,
  SeatingScopeHint,
} from "./types.js";
import type { Doc } from "../../_generated/dataModel.js";

export type PrepareSeatingInputArgs = {
  classId: Id<"classes">;
  layoutId: Id<"seatLayouts">;
  layoutItems: Array<SeatLayoutItemSnapshot>;
  lockedAssignments: ReadonlyArray<LockedAssignment>;
  scope?: SeatingAlgorithmScope;
  scopeHint?: SeatingScopeHint;
  randomSeed: string;
  genderParityMode: GenderParityMode;
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

/** Server-compatible pure wrapper around the seating pipeline. */
export function runSeatingAlgorithm(
  args: RunSeatingAlgorithmArgs,
): ReturnType<typeof finishSeatingAlgorithm> {
  const input = prepareSeatingAlgorithmInput({
    ...args,
    resolveTeamKey: (groupId, desk) => teamHistoryKey(groupId, desk.teamAssignment),
  });

  return finishSeatingAlgorithm({
    input,
    lockedAssignments: args.lockedAssignments,
    memberships: args.memberships,
    deskById: args.deskById,
  });
}

export { slotKey } from "./seatChartGeometry.js";
