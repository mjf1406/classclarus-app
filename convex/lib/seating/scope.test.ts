import { describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel.js";
import {
  groupIdsInScope,
  inferSeatingScope,
  movableStudentIds,
  studentInSeatingScope,
} from "./scope.js";

const groupA = "groupA" as Id<"groups">;
const groupB = "groupB" as Id<"groups">;
const team1 = "team1" as Id<"teams">;
const s1 = "s1" as Id<"users">;
const s2 = "s2" as Id<"users">;

describe("inferSeatingScope", () => {
  test("defaults to class scope", () => {
    expect(inferSeatingScope({})).toEqual({ kind: "class" });
  });

  test("prefers team hint over group hint", () => {
    expect(
      inferSeatingScope({
        hint: { groupIds: [groupA], teamIds: [team1] },
      }),
    ).toEqual({ kind: "team", teamIds: [team1] });
  });

  test("uses explicit scope when provided", () => {
    expect(inferSeatingScope({ explicit: { kind: "group", groupIds: [groupA] } })).toEqual({
      kind: "group",
      groupIds: [groupA],
    });
  });
});

describe("movableStudentIds", () => {
  const memberships = [
    { studentUserId: s1, groupId: groupA, teamId: team1 },
    { studentUserId: s2, groupId: groupB },
  ];

  test("excludes locked students", () => {
    const ids = movableStudentIds({
      memberships,
      scope: { kind: "class" },
      lockedStudentUserIds: new Set([s1]),
    });
    expect(ids).toEqual([s2]);
  });

  test("filters by group scope", () => {
    const ids = movableStudentIds({
      memberships,
      scope: { kind: "group", groupIds: [groupA] },
      lockedStudentUserIds: new Set(),
    });
    expect(ids).toEqual([s1]);
  });
});

describe("groupIdsInScope", () => {
  test("includes groups from locked assignments", () => {
    const ids = groupIdsInScope({
      memberships: [{ studentUserId: s1, groupId: groupA }],
      scope: { kind: "group", groupIds: [groupA] },
      lockedAssignments: [{ groupId: groupB, studentUserId: s2 }],
    });
    expect(ids.sort()).toEqual([groupA, groupB].sort());
  });
});

describe("studentInSeatingScope", () => {
  test("team scope requires team membership", () => {
    expect(
      studentInSeatingScope(
        { studentUserId: s1, groupId: groupA, teamId: team1 },
        { kind: "team", teamIds: [team1] },
      ),
    ).toBe(true);
    expect(
      studentInSeatingScope(
        { studentUserId: s2, groupId: groupB },
        { kind: "team", teamIds: [team1] },
      ),
    ).toBe(false);
  });
});
