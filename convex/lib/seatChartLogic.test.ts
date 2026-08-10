import { describe, expect, test } from "vitest";

import { areDeskTeammates } from "../../convex/lib/seatChartLogic.js";
import type { Id } from "../../convex/_generated/dataModel.js";

const studentA = "studentA" as Id<"users">;
const studentB = "studentB" as Id<"users">;
const groupG1 = "groupG1" as Id<"groups">;

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
      ["d1", "name:Red"],
      ["d2", "name:Red"],
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
      ["d1", "name:Red"],
      ["d2", "name:Blue"],
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
    const teamKeyByDesk = new Map<string, string | undefined>([["d1", "name:Red"]]);

    expect(
      areDeskTeammates(studentA, studentB, assignmentByStudent, teamKeyByDesk, groupIdByStudent),
    ).toBe(false);
  });
});
