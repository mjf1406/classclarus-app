import { describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel.js";
import { mergeAlgorithmAssignments } from "./mergeAssignments.js";
import type { ChartAssignment } from "./seatChartGeometry.js";

const groupA = "groupA" as Id<"groups">;
const groupB = "groupB" as Id<"groups">;
const student1 = "student1" as Id<"users">;
const student2 = "student2" as Id<"users">;
const student3 = "student3" as Id<"users">;

describe("mergeAlgorithmAssignments", () => {
  test("preserves locked assignments", () => {
    const locked: Array<ChartAssignment> = [
      { deskItemId: "d1", groupId: groupA, studentUserId: student1 },
    ];
    const proposed: Array<ChartAssignment> = [
      { deskItemId: "d2", groupId: groupA, studentUserId: student2 },
    ];
    const merged = mergeAlgorithmAssignments({
      locked,
      proposed,
      movableStudentIds: new Set([student2]),
    });
    expect(merged).toHaveLength(2);
    expect(merged.find((a) => a.studentUserId === student1)?.deskItemId).toBe("d1");
  });

  test("allows different groups on same desk", () => {
    const locked: Array<ChartAssignment> = [
      { deskItemId: "d1", groupId: groupA, studentUserId: student1 },
    ];
    const proposed: Array<ChartAssignment> = [
      { deskItemId: "d1", groupId: groupB, studentUserId: student2 },
    ];
    const merged = mergeAlgorithmAssignments({
      locked,
      proposed,
      movableStudentIds: new Set([student2]),
    });
    expect(merged).toHaveLength(2);
  });

  test("ignores proposed moves for locked students", () => {
    const locked: Array<ChartAssignment> = [
      { deskItemId: "d1", groupId: groupA, studentUserId: student1 },
    ];
    const proposed: Array<ChartAssignment> = [
      { deskItemId: "d2", groupId: groupA, studentUserId: student1 },
      { deskItemId: "d2", groupId: groupA, studentUserId: student3 },
    ];
    const merged = mergeAlgorithmAssignments({
      locked,
      proposed,
      movableStudentIds: new Set([student1, student3]),
    });
    expect(merged.find((a) => a.studentUserId === student1)?.deskItemId).toBe("d1");
    expect(merged.find((a) => a.studentUserId === student3)?.deskItemId).toBe("d2");
  });
});
