import type { Doc, Id } from "../../_generated/dataModel.js";
import type { ChartAssignment } from "./seatChartGeometry.js";

export type SeatingFairnessDimension = "neighbor" | "seat" | "zone" | "team";

export type GenderParityMode = "off" | "oddEven";

export type SeatingAlgorithmScopeKind = "class" | "group" | "team";

export type SeatingAlgorithmScope =
  | { kind: "class" }
  | { kind: "group"; groupIds: Array<Id<"groups">> }
  | { kind: "team"; teamIds: Array<Id<"teams">> };

export type LockedAssignment = ChartAssignment;

export type SeatingDeskSlot = {
  deskItemId: string;
  groupId: Id<"groups">;
  deskNumber?: number;
  zoneName?: string;
  teamKey?: string;
  neighborDeskIds: Array<string>;
};

export type GenderBucket = "m" | "f" | "other" | "unknown";

export type SeatingStudent = {
  studentUserId: Id<"users">;
  groupId: Id<"groups">;
  teamId?: Id<"teams">;
  gender?: Doc<"studentRosters">["gender"];
  genderBucket: GenderBucket;
};

export type SeatingConstraint = {
  id: Id<"seatConstraints">;
  type: Doc<"seatConstraints">["type"];
  polarity: Doc<"seatConstraints">["polarity"];
  studentUserId: Id<"users">;
  otherStudentUserId?: Id<"users">;
  zoneName?: string;
};

export type LayoutHistoryDimension = Doc<"seatLayoutAggregates">["dimension"];

export type LayoutHistoryStats = {
  byStudent: Map<
    Id<"users">,
    {
      seat: Map<string, number>;
      zone: Map<string, number>;
      team: Map<string, number>;
      neighbor: Map<Id<"users">, number>;
      combination: Map<string, number>;
      total: number;
    }
  >;
};

export type GenderParityAssignment = {
  /** When mode is oddEven: males on odd desks, females on even (or reversed). */
  malesOnOddDesks: boolean;
};

export type SeatingAlgorithmInput = {
  layoutId: Id<"seatLayouts">;
  slots: ReadonlyArray<SeatingDeskSlot>;
  students: ReadonlyArray<SeatingStudent>;
  locked: ReadonlyArray<LockedAssignment>;
  constraints: ReadonlyArray<SeatingConstraint>;
  history: LayoutHistoryStats;
  scope: SeatingAlgorithmScope;
  genderParityMode: GenderParityMode;
  genderParityAssignment: GenderParityAssignment;
  randomSeed: string;
};

export type SeatingAlgorithmSuccess = {
  status: "ok";
  assignments: ReadonlyArray<ChartAssignment>;
  meta: {
    unseatedStudentIds: Array<Id<"users">>;
    fairnessVector?: Array<number>;
    violationCount: number;
  };
};

export type SeatingAlgorithmInfeasible = {
  status: "infeasible";
  message: string;
  code: "SEATING_INFEASIBLE";
  unseatedStudentIds: Array<Id<"users">>;
  evidence: SeatingFailureEvidence;
};

export type SeatingAlgorithmSearchExhausted = {
  status: "search_exhausted";
  message: string;
  code: "SEATING_SEARCH_EXHAUSTED";
  evidence: SeatingFailureEvidence;
};

export type SeatingAlgorithmResult =
  | SeatingAlgorithmSuccess
  | SeatingAlgorithmInfeasible
  | SeatingAlgorithmSearchExhausted;

export type SeatingScopeHint = {
  groupIds?: ReadonlyArray<Id<"groups">>;
  teamIds?: ReadonlyArray<Id<"teams">>;
};

/** One relaxable rule that can be temporarily omitted for this auto-assign attempt. */
export type SeatingRelaxableRule =
  | { kind: "constraint"; constraintId: Id<"seatConstraints"> }
  | { kind: "genderParity" }
  | { kind: "lockedSeat"; studentUserId: Id<"users"> };

/** Temporary relaxations for a single auto-assign run (does not change saved data). */
export type SeatingRelaxations = {
  omittedConstraintIds?: Array<Id<"seatConstraints">>;
  omitGenderParity?: boolean;
  omittedLockedStudentIds?: Array<Id<"users">>;
};

export type SeatingStructuralCause =
  | "unavailableSeat"
  | "duplicateManual"
  | "capacityExceeded"
  | "unavailableStudent"
  | "noValidSeat"
  | "manualConstraintConflict"
  | "parityLockedConflict"
  | "constraintParityConflict";

export type UnavailableStudentRole = "primary" | "other";

export type SeatingFailureEvidence =
  | {
      kind: "unavailableStudents";
      students: Array<{
        studentUserId: Id<"users">;
        referencingConstraints: Array<{
          constraintId: Id<"seatConstraints">;
          roles: Array<UnavailableStudentRole>;
        }>;
      }>;
    }
  | {
      kind: "capacityExceeded";
      groups: Array<{
        groupId: Id<"groups">;
        availableSeats: number;
        requiredCount: number;
        requiredStudentIds: Array<Id<"users">>;
        contributingConstraintIds: Array<Id<"seatConstraints">>;
      }>;
    }
  | {
      kind: "noValidSeat";
      students: Array<{
        studentUserId: Id<"users">;
        groupId: Id<"groups">;
        candidateSeatCount: number;
        groupSlotCount: number;
        parityEliminated: number;
        zoneEliminated: number;
        occupiedEliminated: number;
      }>;
    }
  | {
      kind: "unavailableSeat";
      locks: Array<{
        studentUserId: Id<"users">;
        deskItemId: string;
        groupId: Id<"groups">;
        deskNumber?: number;
        zoneName?: string;
      }>;
    }
  | {
      kind: "duplicateManual";
      duplicateStudentIds: Array<Id<"users">>;
      duplicateDeskKeys: Array<string>;
    }
  | {
      kind: "parityLockedConflict";
      locks: Array<{
        studentUserId: Id<"users">;
        deskItemId: string;
        groupId: Id<"groups">;
        deskNumber?: number;
        zoneName?: string;
      }>;
      malesOnOddDesks: boolean;
    }
  | {
      kind: "manualConstraintConflict";
      locks: Array<{
        studentUserId: Id<"users">;
        deskItemId: string;
        groupId: Id<"groups">;
        deskNumber?: number;
        zoneName?: string;
      }>;
      conflictingConstraintIds: Array<Id<"seatConstraints">>;
    }
  | {
      kind: "constraintParityConflict";
      affectedStudentIds: Array<Id<"users">>;
      malesOnOddDesks: boolean;
    }
  | {
      kind: "searchExhausted";
      movableStudentCount: number;
      constraintCount: number;
      lockedCount: number;
      slotCount: number;
      genderParityMode: GenderParityMode;
    };

export type SeatingFailureRunContext = {
  layoutId: Id<"seatLayouts">;
  genderParityMode: GenderParityMode;
  malesOnOddDesks: boolean;
  lockedAssignments: Array<{
    studentUserId: Id<"users">;
    deskItemId: string;
    groupId: Id<"groups">;
    deskNumber?: number;
    zoneName?: string;
  }>;
  counts: {
    solverStudentCount: number;
    constraintCount: number;
    slotCount: number;
    lockedCount: number;
  };
};

export type SeatingConflictDiagnosis =
  | { status: "satisfiable" }
  | {
      status: "unknown";
      code: "SEATING_SEARCH_EXHAUSTED" | "SEATING_INFEASIBLE";
      evidence?: SeatingFailureEvidence;
      runContext: SeatingFailureRunContext;
    }
  | {
      status: "structural";
      cause: SeatingStructuralCause;
      evidence: SeatingFailureEvidence;
      affectedStudentIds: Array<Id<"users">>;
      runContext: SeatingFailureRunContext;
    }
  | {
      status: "minimalConflict";
      rules: Array<SeatingRelaxableRule>;
      runContext: SeatingFailureRunContext;
    };
