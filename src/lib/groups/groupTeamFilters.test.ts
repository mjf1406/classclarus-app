import { describe, expect, test } from "vite-plus/test";

import type { GroupsBoard } from "@/lib/groups/groups";

import {
  allowedTeamIdsForFilters,
  buildMembershipIndex,
  pruneOrphanedTeamIds,
  toggleGroupFilter,
  toggleTeamFilter,
  toggleUngroupedFilter,
  type GroupTeamFilterState,
} from "./groupTeamFilters";

const board = {
  ungrouped: [{ userId: "d" }],
  groups: [
    {
      _id: "g1",
      students: [{ userId: "b" }],
      teams: [
        { _id: "t1", students: [{ userId: "a" }] },
        { _id: "t3", students: [] },
      ],
    },
    {
      _id: "g2",
      students: [],
      teams: [{ _id: "t2", students: [{ userId: "c" }] }],
    },
  ],
} as unknown as GroupsBoard;

describe("groupTeamFilters helpers", () => {
  test("buildMembershipIndex maps group-only, team, and ungrouped students", () => {
    expect(buildMembershipIndex(board)).toEqual({
      d: {},
      b: { groupId: "g1" },
      a: { groupId: "g1", teamId: "t1" },
      c: { groupId: "g2", teamId: "t2" },
    });
  });

  test("allowedTeamIdsForFilters returns all teams when no group is selected", () => {
    expect([...allowedTeamIdsForFilters(board, [])].sort()).toEqual(["t1", "t2", "t3"]);
  });

  test("allowedTeamIdsForFilters scopes teams to selected groups", () => {
    expect([...allowedTeamIdsForFilters(board, ["g1"])].sort()).toEqual(["t1", "t3"]);
  });

  test("pruneOrphanedTeamIds drops teams outside the allowed set", () => {
    const state: GroupTeamFilterState = {
      groupIds: ["g1"],
      teamIds: ["t1", "t2"],
      includeUngrouped: false,
    };
    expect(pruneOrphanedTeamIds(state, allowedTeamIdsForFilters(board, ["g1"]))).toEqual({
      groupIds: ["g1"],
      teamIds: ["t1"],
      includeUngrouped: false,
    });
  });

  test("toggles flip membership selection flags and ids", () => {
    let state: GroupTeamFilterState = {
      groupIds: [],
      teamIds: [],
      includeUngrouped: false,
    };
    state = toggleGroupFilter(state, "g1");
    state = toggleTeamFilter(state, "t1");
    state = toggleUngroupedFilter(state);
    expect(state).toEqual({
      groupIds: ["g1"],
      teamIds: ["t1"],
      includeUngrouped: true,
    });
    state = toggleGroupFilter(state, "g1");
    expect(state.groupIds).toEqual([]);
  });
});
