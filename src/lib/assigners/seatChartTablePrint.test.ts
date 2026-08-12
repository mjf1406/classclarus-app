import { describe, expect, it } from "vite-plus/test";

import {
  buildSeatChartPrintTableMatrix,
  formatSeatChartTableSeatLabel,
  formatSeatChartTableStudentCell,
} from "@/lib/assigners/seatChartTablePrint";
import {
  DEFAULT_DESK_HEIGHT,
  DEFAULT_DESK_WIDTH,
  type SeatLayoutItem,
} from "@/lib/assigners/seatLayouts";
import type { SeatChartAssignment } from "@/lib/assigners/seatCharts";
import type { GroupsBoard } from "@/lib/groups/groups";
import type { StudentRosterEntry } from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

const nameFormat = { order: "firstLast" as const, space: true };

function student(
  overrides: Partial<StudentRosterEntry> & Pick<StudentRosterEntry, "userId" | "rosterNumber">,
): StudentRosterEntry {
  return {
    role: "student",
    ...overrides,
  };
}

function deskItem(
  id: string,
  deskNumber: number,
  teamAssignment?: SeatLayoutItem["teamAssignment"],
): SeatLayoutItem {
  return {
    id,
    kind: "desk",
    label: "",
    deskNumber,
    x: 0,
    y: 0,
    width: DEFAULT_DESK_WIDTH,
    height: DEFAULT_DESK_HEIGHT,
    teamAssignment,
  };
}

describe("formatSeatChartTableStudentCell", () => {
  it("formats roster number and full roster name using class settings", () => {
    expect(
      formatSeatChartTableStudentCell(
        student({
          userId: "s1" as Id<"users">,
          rosterNumber: 8,
          firstName: "William",
          lastName: "Reed",
        }),
        nameFormat,
        "Unnamed",
      ),
    ).toBe("#8 - William Reed");
  });

  it("respects last-first class name order", () => {
    expect(
      formatSeatChartTableStudentCell(
        student({
          userId: "s1" as Id<"users">,
          rosterNumber: 8,
          firstName: "William",
          lastName: "Reed",
        }),
        { order: "lastFirst", space: true },
        "Unnamed",
      ),
    ).toBe("#8 - Reed William");
  });
});

describe("formatSeatChartTableSeatLabel", () => {
  const board = {
    groups: [
      {
        _id: "g1" as Id<"groups">,
        name: "Group A",
        teams: [{ _id: "t1" as Id<"teams">, name: "Monkeys" }],
      },
    ],
  } as unknown as GroupsBoard;

  it("includes team name before seat number", () => {
    expect(
      formatSeatChartTableSeatLabel(
        deskItem("d1", 12, { mode: "byName", teamName: "Monkeys" }),
        board,
      ),
    ).toBe("(Monkeys) 12");
  });

  it("falls back to seat number when no team is assigned", () => {
    expect(formatSeatChartTableSeatLabel(deskItem("d1", 12), board)).toBe("12");
  });
});

describe("buildSeatChartPrintTableMatrix", () => {
  const groupA = "g1" as Id<"groups">;
  const groupB = "g2" as Id<"groups">;
  const studentA = "s1" as Id<"users">;
  const studentB = "s2" as Id<"users">;

  const board = {
    groups: [
      { _id: groupA, name: "Group A", teams: [] },
      { _id: groupB, name: "Group B", teams: [] },
    ],
  } as unknown as GroupsBoard;

  const assignments: Array<SeatChartAssignment> = [
    { deskItemId: "d1", groupId: groupA, studentUserId: studentA },
    { deskItemId: "d2", groupId: groupB, studentUserId: studentB },
  ];

  const roster = [
    student({
      userId: studentA,
      rosterNumber: 8,
      firstName: "William",
      lastName: "Reed",
    }),
    student({
      userId: studentB,
      rosterNumber: 19,
      firstName: "Sophia",
      lastName: "Lee",
    }),
  ];

  it("builds rows by desk number and columns by group", () => {
    const matrix = buildSeatChartPrintTableMatrix({
      layoutItems: [
        deskItem("d2", 9, { mode: "byName", teamName: "Horses" }),
        deskItem("d1", 8, { mode: "byName", teamName: "Monkeys" }),
      ],
      assignments,
      roster,
      board,
      nameFormat,
      unnamedLabel: "Unnamed",
    });

    expect(matrix.groupNames).toEqual(["Group A", "Group B"]);
    expect(matrix.rows).toEqual([
      {
        seatLabel: "(Monkeys) 8",
        cells: ["#8 - William Reed", ""],
      },
      {
        seatLabel: "(Horses) 9",
        cells: ["", "#19 - Sophia Lee"],
      },
    ]);
  });
});
