import { describe, expect, test } from "vite-plus/test";

import {
  assignStudentToSlot,
  assignmentsEqual,
  neighborDeskIdsForDesk,
  slotKey,
  swapDeskAssignments,
  unassignDeskSlot,
} from "@/lib/assigners/seatCharts";
import type { Id } from "../../../convex/_generated/dataModel";

const studentA = "studentA" as Id<"users">;
const studentB = "studentB" as Id<"users">;
const groupG1 = "groupG1" as Id<"groups">;
const groupG2 = "groupG2" as Id<"groups">;

describe("seatCharts assignments", () => {
  test("assignStudentToSlot replaces prior desk and slot", () => {
    const initial = [{ deskItemId: "d1", groupId: groupG1, studentUserId: studentA }];
    const next = assignStudentToSlot(initial, "d2", groupG1, studentA);
    expect(next).toEqual([{ deskItemId: "d2", groupId: groupG1, studentUserId: studentA }]);
  });

  test("assignStudentToSlot allows two groups on one desk", () => {
    const initial = [{ deskItemId: "d1", groupId: groupG1, studentUserId: studentA }];
    const next = assignStudentToSlot(initial, "d1", groupG2, studentB);
    expect(next).toEqual([
      { deskItemId: "d1", groupId: groupG1, studentUserId: studentA },
      { deskItemId: "d1", groupId: groupG2, studentUserId: studentB },
    ]);
  });

  test("swapDeskAssignments exchanges all slots on two desks", () => {
    const initial = [
      { deskItemId: "d1", groupId: groupG1, studentUserId: studentA },
      { deskItemId: "d2", groupId: groupG1, studentUserId: studentB },
    ];
    expect(swapDeskAssignments(initial, "d1", "d2")).toEqual([
      { deskItemId: "d2", groupId: groupG1, studentUserId: studentA },
      { deskItemId: "d1", groupId: groupG1, studentUserId: studentB },
    ]);
  });

  test("unassignDeskSlot removes one slot", () => {
    const initial = [
      { deskItemId: "d1", groupId: groupG1, studentUserId: studentA },
      { deskItemId: "d1", groupId: groupG2, studentUserId: studentB },
    ];
    expect(unassignDeskSlot(initial, "d1", groupG1)).toEqual([
      { deskItemId: "d1", groupId: groupG2, studentUserId: studentB },
    ]);
  });

  test("assignmentsEqual compares slot maps", () => {
    const a = [{ deskItemId: "d1", groupId: groupG1, studentUserId: studentA }];
    const b = [{ deskItemId: "d1", groupId: groupG1, studentUserId: studentA }];
    expect(assignmentsEqual(a, b)).toBe(true);
    expect(
      assignmentsEqual(a, [{ deskItemId: "d2", groupId: groupG1, studentUserId: studentA }]),
    ).toBe(false);
    expect(slotKey("d1", groupG1)).toBe("d1:groupG1");
  });
});

describe("strict chart neighbors", () => {
  const items = [
    { id: "d1", kind: "desk" as const, label: "1", x: 0, y: 0, width: 80, height: 60 },
    { id: "d2", kind: "desk" as const, label: "2", x: 80, y: 0, width: 80, height: 60 },
    { id: "d3", kind: "desk" as const, label: "3", x: 0, y: 60, width: 80, height: 60 },
    { id: "corner", kind: "desk" as const, label: "4", x: 80, y: 60, width: 80, height: 60 },
  ];

  test("detects side neighbors but not diagonal-only contact", () => {
    expect(neighborDeskIdsForDesk(items, "d1").sort()).toEqual(["d2", "d3"]);
    expect(neighborDeskIdsForDesk(items, "corner").sort()).toEqual(["d2", "d3"]);
    const diagonalOnly = [
      { id: "a", kind: "desk" as const, label: "A", x: 0, y: 0, width: 80, height: 60 },
      { id: "b", kind: "desk" as const, label: "B", x: 80, y: 61, width: 80, height: 60 },
    ];
    expect(neighborDeskIdsForDesk(diagonalOnly, "a")).toEqual([]);
  });
});
