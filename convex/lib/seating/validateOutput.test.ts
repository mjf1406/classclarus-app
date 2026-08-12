import { describe, expect, it } from "vite-plus/test";

import type { Id } from "../../_generated/dataModel.js";
import type { ChartAssignment, SeatLayoutItemSnapshot } from "./seatChartGeometry.js";
import { validateMergedAssignments } from "./validateOutput.js";

const groupId = "group" as Id<"groups">;
const studentId = "student" as Id<"users">;
const otherId = "other" as Id<"users">;
const desks = new Map<string, SeatLayoutItemSnapshot>([
  [
    "desk-1",
    {
      id: "desk-1",
      kind: "desk",
      label: "",
      deskNumber: 1,
      x: 0,
      y: 0,
      width: 40,
      height: 40,
    },
  ],
  [
    "desk-2",
    {
      id: "desk-2",
      kind: "desk",
      label: "",
      deskNumber: 2,
      x: 40,
      y: 0,
      width: 40,
      height: 40,
    },
  ],
]);
const memberships = new Map([
  [studentId, groupId],
  [otherId, groupId],
]);
const locked: ChartAssignment = { deskItemId: "desk-1", groupId, studentUserId: studentId };

function validate(assignments: ChartAssignment[], lockedAssignments: ChartAssignment[] = []) {
  return validateMergedAssignments({
    assignments,
    deskById: desks,
    membershipGroupByStudent: memberships,
    lockedStudentUserIds: new Set(lockedAssignments.map((row) => row.studentUserId)),
    lockedAssignments,
  });
}

describe("validateMergedAssignments", () => {
  it("accepts a valid chart with an unchanged lock", () => {
    expect(validate([locked], [locked])).toBeNull();
  });

  it.each([
    ["SEATING_INVALID_DESK", [{ ...locked, deskItemId: "missing" }], []],
    ["SEATING_DUPLICATE_SLOT", [locked, { ...locked, studentUserId: otherId }], []],
    ["SEATING_DUPLICATE_STUDENT", [locked, { ...locked, deskItemId: "desk-2" }], []],
    ["SEATING_LOCKED_MOVED", [{ ...locked, deskItemId: "desk-2" }], [locked]],
    ["SEATING_LOCKED_MISSING", [], [locked]],
  ] as const)("returns %s for invalid output", (code, assignments, locks) => {
    expect(
      validate(
        assignments.map((row) => ({ ...row })),
        locks.map((row) => ({ ...row })),
      )?.code,
    ).toBe(code);
  });
});
