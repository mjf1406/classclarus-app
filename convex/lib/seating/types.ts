import type { Doc, Id } from "../../_generated/dataModel.js";
import type { ChartAssignment } from "../seatChartGeometry.js";

export type SeatingWeightKey = "seat" | "zone" | "team" | "neighbor" | "gender" | "combination";

export type SeatingWeights = Record<SeatingWeightKey, number>;

export type GenderParityMode = "off" | "oddEven";

export type SeatAlgorithmSettings = {
  weights: SeatingWeights;
  genderParity: {
    mode: GenderParityMode;
  };
};

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
  settings: SeatAlgorithmSettings;
  scope: SeatingAlgorithmScope;
  genderParityAssignment: GenderParityAssignment;
  randomSeed: string;
};

export type SeatingAlgorithmSuccess = {
  status: "ok";
  assignments: ReadonlyArray<ChartAssignment>;
  meta: {
    unseatedStudentIds: Array<Id<"users">>;
    score?: number;
    violationCount: number;
  };
};

export type SeatingAlgorithmNotImplemented = {
  status: "not_implemented";
  message: string;
  code: "SEATING_ALGORITHM_NOT_IMPLEMENTED";
};

export type SeatingAlgorithmInfeasible = {
  status: "infeasible";
  message: string;
  unseatedStudentIds: Array<Id<"users">>;
};

export type SeatingAlgorithmResult =
  | SeatingAlgorithmSuccess
  | SeatingAlgorithmNotImplemented
  | SeatingAlgorithmInfeasible;

export type SeatingScopeHint = {
  groupIds?: ReadonlyArray<Id<"groups">>;
  teamIds?: ReadonlyArray<Id<"teams">>;
};
