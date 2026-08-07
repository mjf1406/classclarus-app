import { describe, expect, test } from "vite-plus/test";

import type { MembershipByUserId } from "@/lib/groups/groupTeamFilters";

import {
  filterStudentRosterIds,
  type FilterableRosterStudent,
  type StudentRosterFilterCriteria,
} from "./studentRosterFilter";

const students: FilterableRosterStudent[] = [
  { id: "a", name: "Alice Smith", email: "alice@school.edu" },
  { id: "b", name: "Bob Jones", email: "bob@school.edu" },
  { id: "c", name: "Carol Lee", email: "carol@school.edu" },
  { id: "d", name: "Dan Park", email: "dan@school.edu" },
];

const membershipByUserId: MembershipByUserId = {
  a: { groupId: "g1", teamId: "t1" },
  b: { groupId: "g1" },
  c: { groupId: "g2", teamId: "t2" },
  d: {},
};

function criteria(partial: Partial<StudentRosterFilterCriteria> = {}): StudentRosterFilterCriteria {
  return {
    query: "",
    groupIds: [],
    teamIds: [],
    includeUngrouped: false,
    ...partial,
  };
}

describe("filterStudentRosterIds", () => {
  test("returns all ids when no filters are set", () => {
    expect(filterStudentRosterIds(students, membershipByUserId, criteria())).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  test("filters by selected groups (OR within groups)", () => {
    expect(
      filterStudentRosterIds(students, membershipByUserId, criteria({ groupIds: ["g1"] })),
    ).toEqual(["a", "b"]);

    expect(
      filterStudentRosterIds(students, membershipByUserId, criteria({ groupIds: ["g1", "g2"] })),
    ).toEqual(["a", "b", "c"]);
  });

  test("filters ungrouped students", () => {
    expect(
      filterStudentRosterIds(students, membershipByUserId, criteria({ includeUngrouped: true })),
    ).toEqual(["d"]);
  });

  test("combines ungrouped with selected groups", () => {
    expect(
      filterStudentRosterIds(
        students,
        membershipByUserId,
        criteria({ groupIds: ["g2"], includeUngrouped: true }),
      ),
    ).toEqual(["c", "d"]);
  });

  test("filters by teams (OR within teams)", () => {
    expect(
      filterStudentRosterIds(students, membershipByUserId, criteria({ teamIds: ["t1", "t2"] })),
    ).toEqual(["a", "c"]);
  });

  test("intersects groups and teams", () => {
    expect(
      filterStudentRosterIds(
        students,
        membershipByUserId,
        criteria({ groupIds: ["g1"], teamIds: ["t1", "t2"] }),
      ),
    ).toEqual(["a"]);

    expect(
      filterStudentRosterIds(
        students,
        membershipByUserId,
        criteria({ groupIds: ["g1"], teamIds: ["t2"] }),
      ),
    ).toEqual([]);
  });

  test("intersects ungrouped with teams as empty", () => {
    expect(
      filterStudentRosterIds(
        students,
        membershipByUserId,
        criteria({ includeUngrouped: true, teamIds: ["t1"] }),
      ),
    ).toEqual([]);
  });

  test("applies search AND membership filters", () => {
    expect(
      filterStudentRosterIds(
        students,
        membershipByUserId,
        criteria({ groupIds: ["g1", "g2"], query: "carol" }),
      ),
    ).toEqual(["c"]);

    expect(
      filterStudentRosterIds(
        students,
        membershipByUserId,
        criteria({ groupIds: ["g1"], query: "alice" }),
      ),
    ).toEqual(["a"]);
  });

  test("treats missing membership as ungrouped", () => {
    expect(
      filterStudentRosterIds([{ id: "z", name: "Zoe" }], {}, criteria({ includeUngrouped: true })),
    ).toEqual(["z"]);
  });
});
