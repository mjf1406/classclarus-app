import { describe, expect, test } from "vitest";

import { areDeskTeammates, sameGroupNeighborStudentIds } from "./seatChartLogic.js";
import type { Id } from "../../_generated/dataModel.js";
import { slotKey } from "./seatChartGeometry.js";

const studentA = "studentA" as Id<"users">;
const studentB = "studentB" as Id<"users">;
const studentC = "studentC" as Id<"users">;
const groupG1 = "groupG1" as Id<"groups">;
const groupG2 = "groupG2" as Id<"groups">;

describe("sameGroupNeighborStudentIds", () => {
  test("includes adjacent same-group students and excludes other groups", () => {
    const studentsByDesk = new Map<string, Array<Id<"users">>>([["d5", [studentB, studentC]]]);
    const groupIdByStudent = new Map<Id<"users">, Id<"groups">>([
      [studentA, groupG1],
      [studentB, groupG1],
      [studentC, groupG2],
    ]);

    expect(sameGroupNeighborStudentIds(groupG1, ["d5"], studentsByDesk, groupIdByStudent)).toEqual([
      studentB,
    ]);
  });
});

describe("areDeskTeammates", () => {
  test("requires same group and matching desk team keys on different desks", () => {
    const assignmentByStudent = new Map<Id<"users">, string>([
      [studentA, "d1"],
      [studentB, "d2"],
    ]);
    const groupIdByStudent = new Map<Id<"users">, Id<"groups">>([
      [studentA, groupG1],
      [studentB, groupG1],
    ]);
    const teamKeyByDesk = new Map<string, string | undefined>([
      [slotKey("d1", groupG1), "name:Red"],
      [slotKey("d2", groupG1), "name:Red"],
    ]);

    expect(
      areDeskTeammates(studentA, studentB, assignmentByStudent, teamKeyByDesk, groupIdByStudent),
    ).toBe(true);
  });

  test("returns false for different team keys", () => {
    const assignmentByStudent = new Map<Id<"users">, string>([
      [studentA, "d1"],
      [studentB, "d2"],
    ]);
    const groupIdByStudent = new Map<Id<"users">, Id<"groups">>([
      [studentA, groupG1],
      [studentB, groupG1],
    ]);
    const teamKeyByDesk = new Map<string, string | undefined>([
      [slotKey("d1", groupG1), "name:Red"],
      [slotKey("d2", groupG1), "name:Blue"],
    ]);

    expect(
      areDeskTeammates(studentA, studentB, assignmentByStudent, teamKeyByDesk, groupIdByStudent),
    ).toBe(false);
  });

  test("returns false when students share a desk", () => {
    const assignmentByStudent = new Map<Id<"users">, string>([
      [studentA, "d1"],
      [studentB, "d1"],
    ]);
    const groupIdByStudent = new Map<Id<"users">, Id<"groups">>([
      [studentA, groupG1],
      [studentB, groupG1],
    ]);
    const teamKeyByDesk = new Map<string, string | undefined>([
      [slotKey("d1", groupG1), "name:Red"],
    ]);

    expect(
      areDeskTeammates(studentA, studentB, assignmentByStudent, teamKeyByDesk, groupIdByStudent),
    ).toBe(false);
  });
});
