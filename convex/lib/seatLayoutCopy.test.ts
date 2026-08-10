import { describe, expect, test } from "vitest";

import type { Id } from "../_generated/dataModel.js";
import { copySeatLayoutItems, type SeatLayoutItemForCopy } from "./seatLayoutCopy.js";

const groupId = "group1" as Id<"groups">;
const teamId = "team1" as Id<"teams">;

const sampleItems: SeatLayoutItemForCopy[] = [
  {
    id: "desk-1",
    kind: "desk",
    label: "1",
    deskNumber: 1,
    teamAssignment: { mode: "single", groupId, teamId },
    zoneName: "Front",
    x: 10,
    y: 20,
    width: 60,
    height: 40,
  },
  {
    id: "desk-2",
    kind: "desk",
    label: "2",
    deskNumber: 2,
    teamAssignment: { mode: "byName", teamName: "Red" },
    x: 80,
    y: 20,
    width: 60,
    height: 40,
  },
  {
    id: "board-1",
    kind: "board",
    label: "Board",
    x: 0,
    y: 0,
    width: 200,
    height: 40,
  },
];

describe("copySeatLayoutItems", () => {
  test("preserves single team assignments within the same class", () => {
    const copied = copySeatLayoutItems(sampleItems, { preserveSingleTeamAssignments: true });
    expect(copied[0]?.teamAssignment).toEqual({
      mode: "single",
      groupId,
      teamId,
    });
    expect(copied[1]?.teamAssignment).toEqual({ mode: "byName", teamName: "Red" });
    expect(copied[0]?.zoneName).toBe("Front");
    expect(copied[2]?.kind).toBe("board");
  });

  test("strips single team assignments across classes but keeps byName and zones", () => {
    const copied = copySeatLayoutItems(sampleItems, { preserveSingleTeamAssignments: false });
    expect(copied[0]?.teamAssignment).toBeUndefined();
    expect(copied[0]?.zoneName).toBe("Front");
    expect(copied[1]?.teamAssignment).toEqual({ mode: "byName", teamName: "Red" });
    expect(copied).toHaveLength(3);
  });

  test("does not mutate the source items", () => {
    const before = structuredClone(sampleItems);
    copySeatLayoutItems(sampleItems, { preserveSingleTeamAssignments: false });
    expect(sampleItems).toEqual(before);
  });
});
