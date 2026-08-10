import { describe, expect, test } from "vitest";

import type { Id } from "../_generated/dataModel.js";
import {
  deskTeamAssignmentAppliesToGroup,
  formatUnresolvedDeskTeamError,
  type UnresolvedDeskTeam,
} from "./seatChartLogic.js";
import {
  clearLayoutItemsTeamAssignments,
  rewriteLayoutItemsByNameTeamLabel,
} from "./seatLayoutTeamSync.js";

const groupG1 = "groupG1" as Id<"groups">;
const groupG2 = "groupG2" as Id<"groups">;
const teamT1 = "teamT1" as Id<"teams">;

describe("deskTeamAssignmentAppliesToGroup", () => {
  test("byName applies to every group", () => {
    expect(deskTeamAssignmentAppliesToGroup({ mode: "byName", teamName: "Dragons" }, groupG1)).toBe(
      true,
    );
    expect(deskTeamAssignmentAppliesToGroup({ mode: "byName", teamName: "Dragons" }, groupG2)).toBe(
      true,
    );
  });

  test("single applies only to its group", () => {
    expect(
      deskTeamAssignmentAppliesToGroup(
        { mode: "single", groupId: groupG1, teamId: teamT1 },
        groupG1,
      ),
    ).toBe(true);
    expect(
      deskTeamAssignmentAppliesToGroup(
        { mode: "single", groupId: groupG1, teamId: teamT1 },
        groupG2,
      ),
    ).toBe(false);
  });
});

describe("formatUnresolvedDeskTeamError", () => {
  test("lists unique unresolved team labels", () => {
    const unresolved: Array<UnresolvedDeskTeam> = [
      {
        deskItemId: "d1",
        teamLabel: "Horses",
        groupId: groupG1,
      },
      {
        deskItemId: "d2",
        teamLabel: "Apples",
        groupId: groupG1,
      },
      {
        deskItemId: "d3",
        teamLabel: "Horses",
        groupId: groupG2,
      },
    ];

    expect(formatUnresolvedDeskTeamError(unresolved)).toBe(
      "Desk team names do not match any team: Apples, Horses",
    );
  });
});

describe("rewriteLayoutItemsByNameTeamLabel", () => {
  test("rewrites matching byName labels case-insensitively", () => {
    const items = [
      {
        id: "d1",
        kind: "desk" as const,
        label: "1",
        deskNumber: 1,
        teamAssignment: { mode: "byName" as const, teamName: "horses" },
        x: 0,
        y: 0,
        width: 40,
        height: 40,
      },
      {
        id: "d2",
        kind: "desk" as const,
        label: "2",
        deskNumber: 2,
        teamAssignment: { mode: "byName" as const, teamName: "Dragons" },
        x: 50,
        y: 0,
        width: 40,
        height: 40,
      },
    ];

    const { items: next, changed } = rewriteLayoutItemsByNameTeamLabel(items, "Horses", "Cats");
    expect(changed).toBe(true);
    expect(next[0]?.teamAssignment).toEqual({ mode: "byName", teamName: "Cats" });
    expect(next[1]?.teamAssignment).toEqual({ mode: "byName", teamName: "Dragons" });
  });

  test("no-ops when names match ignoring case", () => {
    const items = [
      {
        id: "d1",
        kind: "desk" as const,
        label: "1",
        deskNumber: 1,
        teamAssignment: { mode: "byName" as const, teamName: "Cats" },
        x: 0,
        y: 0,
        width: 40,
        height: 40,
      },
    ];

    const { changed } = rewriteLayoutItemsByNameTeamLabel(items, "cats", "Cats");
    expect(changed).toBe(false);
  });
});

describe("clearLayoutItemsTeamAssignments", () => {
  test("clears single assignments for the removed team and byName when requested", () => {
    const items = [
      {
        id: "d1",
        kind: "desk" as const,
        label: "1",
        deskNumber: 1,
        teamAssignment: { mode: "single" as const, groupId: groupG1, teamId: teamT1 },
        x: 0,
        y: 0,
        width: 40,
        height: 40,
      },
      {
        id: "d2",
        kind: "desk" as const,
        label: "2",
        deskNumber: 2,
        teamAssignment: { mode: "byName" as const, teamName: "Dragons" },
        x: 50,
        y: 0,
        width: 40,
        height: 40,
      },
    ];

    const { items: next, changed } = clearLayoutItemsTeamAssignments(
      items,
      teamT1,
      "Dragons",
      true,
    );
    expect(changed).toBe(true);
    expect(next[0]?.teamAssignment).toBeUndefined();
    expect(next[1]?.teamAssignment).toBeUndefined();
  });

  test("keeps byName when another team still uses the name", () => {
    const items = [
      {
        id: "d1",
        kind: "desk" as const,
        label: "1",
        deskNumber: 1,
        teamAssignment: { mode: "byName" as const, teamName: "Dragons" },
        x: 0,
        y: 0,
        width: 40,
        height: 40,
      },
    ];

    const { items: next, changed } = clearLayoutItemsTeamAssignments(
      items,
      teamT1,
      "Dragons",
      false,
    );
    expect(changed).toBe(false);
    expect(next[0]?.teamAssignment).toEqual({ mode: "byName", teamName: "Dragons" });
  });
});
