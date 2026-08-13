import { describe, expect, it } from "vite-plus/test";

import type { Id } from "../../_generated/dataModel.js";
import type { ChartAssignment, SeatLayoutItemSnapshot } from "./seatChartGeometry.js";
import { validateHardConstraints, validateMergedAssignments } from "./validateOutput.js";

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
    ["SEATING_INVALID_GROUP", [{ ...locked, groupId: "other-group" as Id<"groups"> }], []],
  ] as const)("returns %s for invalid output", (code, assignments, locks) => {
    expect(
      validate(
        assignments.map((row) => ({ ...row })),
        locks.map((row) => ({ ...row })),
      )?.code,
    ).toBe(code);
  });
});

describe("validateHardConstraints", () => {
  const slots = [
    {
      deskItemId: "desk-1",
      groupId,
      deskNumber: 1,
      zoneName: "Front",
      neighborDeskIds: ["desk-2"],
    },
    {
      deskItemId: "desk-2",
      groupId,
      deskNumber: 2,
      zoneName: "Back",
      neighborDeskIds: ["desk-1"],
    },
  ];
  const students = [
    { studentUserId: studentId, groupId, genderBucket: "m" as const },
    { studentUserId: otherId, groupId, genderBucket: "f" as const },
  ];
  const assignments: ChartAssignment[] = [
    { deskItemId: "desk-1", groupId, studentUserId: studentId },
    { deskItemId: "desk-2", groupId, studentUserId: otherId },
  ];

  it("accepts a legal chart", () => {
    expect(
      validateHardConstraints({
        assignments,
        slots,
        students,
        constraints: [],
        genderParityMode: "oddEven",
        genderParityAssignment: { malesOnOddDesks: true },
      }),
    ).toBeNull();
  });

  it("rejects a parity violation", () => {
    expect(
      validateHardConstraints({
        assignments,
        slots,
        students,
        constraints: [],
        genderParityMode: "oddEven",
        genderParityAssignment: { malesOnOddDesks: false },
      })?.code,
    ).toBe("SEATING_OUTPUT_VIOLATION");
  });

  it("rejects a hard constraint violation", () => {
    expect(
      validateHardConstraints({
        assignments,
        slots,
        students,
        constraints: [
          {
            id: "c1" as Id<"seatConstraints">,
            type: "neighbor",
            polarity: "mustNot",
            studentUserId: studentId,
            otherStudentUserId: otherId,
          },
        ],
        genderParityMode: "off",
        genderParityAssignment: { malesOnOddDesks: true },
      })?.code,
    ).toBe("SEATING_OUTPUT_VIOLATION");
  });
});
