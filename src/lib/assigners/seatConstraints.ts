import type { FunctionReturnType } from "convex/server";

import type { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { StudentRosterEntry } from "@/lib/roster/roster";

export type SeatConstraintList = FunctionReturnType<typeof api.seatConstraints.list>;
export type SeatConstraint = SeatConstraintList[number];
export type SeatConstraintType = SeatConstraint["type"];
export type SeatConstraintPolarity = SeatConstraint["polarity"];

export type SeatConstraintFormValues = {
  type: SeatConstraintType;
  polarity: SeatConstraintPolarity;
  studentUserId: Id<"users">;
  otherStudentUserId?: Id<"users">;
  zoneName?: string;
};

/** Roster row for one constraint (same student may appear multiple times). */
export type SeatConstraintRosterRow = StudentRosterEntry & {
  constraintId: Id<"seatConstraints">;
};

export function isPairConstraintType(type: SeatConstraintType): boolean {
  return type === "neighbor" || type === "teammate";
}

export function isSeatConstraintRosterRow(row: StudentRosterEntry): row is SeatConstraintRosterRow {
  return "constraintId" in row && typeof row.constraintId === "string";
}

export function buildSeatConstraintRosterRows(
  constraints: SeatConstraintList,
  roster: StudentRosterEntry[],
): SeatConstraintRosterRow[] {
  const byId = new Map(roster.map((student) => [student.userId, student]));
  const rows: SeatConstraintRosterRow[] = [];
  for (const constraint of constraints) {
    const student = byId.get(constraint.studentUserId);
    if (!student) continue;
    rows.push({
      ...student,
      constraintId: constraint._id,
    });
  }
  return rows;
}

export function seatConstraintSummary(
  constraint: SeatConstraint,
  studentName: (userId: Id<"users">) => string,
  t: (key: string, options?: Record<string, string>) => string,
): string {
  const student = studentName(constraint.studentUserId);
  const polarity =
    constraint.polarity === "must" ? t("constraintPolarityMust") : t("constraintPolarityMustNot");

  if (constraint.type === "zone") {
    return t("constraintSummaryZone", {
      student,
      polarity,
      zone: constraint.zoneName ?? "",
    });
  }

  const other = constraint.otherStudentUserId
    ? studentName(constraint.otherStudentUserId)
    : t("constraintUnknownStudent");
  const relation = isPairConstraintType(constraint.type)
    ? constraint.type === "neighbor"
      ? t("constraintRelationNeighbor")
      : t("constraintRelationTeammate")
    : "";

  return t("constraintSummaryPair", {
    student,
    polarity,
    relation,
    other,
  });
}
