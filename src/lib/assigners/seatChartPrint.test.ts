import { describe, expect, it } from "vite-plus/test";

import {
  buildSeatChartPrintItems,
  formatSeatChartPrintStudentLabel,
} from "@/lib/assigners/seatChartPrint";
import {
  DEFAULT_DESK_HEIGHT,
  DEFAULT_DESK_WIDTH,
  type SeatLayoutItem,
} from "@/lib/assigners/seatLayouts";
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

function deskItem(id: string): SeatLayoutItem {
  return {
    id,
    kind: "desk",
    label: "",
    deskNumber: 1,
    x: 0,
    y: 0,
    width: DEFAULT_DESK_WIDTH,
    height: DEFAULT_DESK_HEIGHT,
  };
}

describe("formatSeatChartPrintStudentLabel", () => {
  it("formats first name, last initial, and roster number", () => {
    expect(
      formatSeatChartPrintStudentLabel(
        student({
          userId: "s1" as Id<"users">,
          rosterNumber: 12,
          firstName: "Emma",
          lastName: "Johnson",
        }),
        "Unnamed",
        nameFormat,
      ),
    ).toBe("Emma J. #12");
  });

  it("respects last-first name order from class settings", () => {
    expect(
      formatSeatChartPrintStudentLabel(
        student({
          userId: "s1" as Id<"users">,
          rosterNumber: 12,
          firstName: "太郎",
          lastName: "田中",
        }),
        "Unnamed",
        { order: "lastFirst", space: true },
      ),
    ).toBe("田中 太. #12");
  });

  it("respects no-space name format from class settings", () => {
    expect(
      formatSeatChartPrintStudentLabel(
        student({
          userId: "s1" as Id<"users">,
          rosterNumber: 12,
          firstName: "Emma",
          lastName: "Johnson",
        }),
        "Unnamed",
        { order: "firstLast", space: false },
      ),
    ).toBe("EmmaJ. #12");
  });

  it("formats first name only with roster number", () => {
    expect(
      formatSeatChartPrintStudentLabel(
        student({
          userId: "s1" as Id<"users">,
          rosterNumber: 4,
          firstName: "Emma",
        }),
        "Unnamed",
        nameFormat,
      ),
    ).toBe("Emma #4");
  });

  it("formats last name only with roster number", () => {
    expect(
      formatSeatChartPrintStudentLabel(
        student({
          userId: "s1" as Id<"users">,
          rosterNumber: 7,
          lastName: "Johnson",
        }),
        "Unnamed",
        nameFormat,
      ),
    ).toBe("J. #7");
  });

  it("shows full last name when only last is known and order is last-first", () => {
    expect(
      formatSeatChartPrintStudentLabel(
        student({
          userId: "s1" as Id<"users">,
          rosterNumber: 7,
          lastName: "田中",
        }),
        "Unnamed",
        { order: "lastFirst", space: true },
      ),
    ).toBe("田中 #7");
  });

  it("falls back to roster display name when first and last are missing", () => {
    expect(
      formatSeatChartPrintStudentLabel(
        student({
          userId: "s1" as Id<"users">,
          rosterNumber: 2,
          name: "Alex Kim",
        }),
        "Unnamed",
        nameFormat,
      ),
    ).toBe("Alex Kim #2");
  });

  it("falls back to unnamed label when no name fields exist", () => {
    expect(
      formatSeatChartPrintStudentLabel(
        student({
          userId: "s1" as Id<"users">,
          rosterNumber: 9,
        }),
        "Unnamed",
        nameFormat,
      ),
    ).toBe("Unnamed #9");
  });
});

describe("buildSeatChartPrintItems", () => {
  const groupId = "g1" as Id<"groups">;
  const studentId = "s1" as Id<"users">;

  const board = {
    groups: [{ _id: groupId, name: "Team A" }],
  } as unknown as GroupsBoard;

  it("uses compact student labels on assigned desks", () => {
    const items = buildSeatChartPrintItems({
      layoutItems: [deskItem("d1")],
      assignments: [{ deskItemId: "d1", groupId, studentUserId: studentId }],
      roster: [
        student({
          userId: studentId,
          rosterNumber: 12,
          firstName: "Emma",
          lastName: "Johnson",
        }),
      ],
      board: { groups: [] } as unknown as GroupsBoard,
      nameFormat,
      unnamedLabel: "Unnamed",
    });

    expect(items[0]?.studentLabel).toBe("Emma J. #12");
  });

  it("appends group suffix when present", () => {
    const items = buildSeatChartPrintItems({
      layoutItems: [deskItem("d1")],
      assignments: [{ deskItemId: "d1", groupId, studentUserId: studentId }],
      roster: [
        student({
          userId: studentId,
          rosterNumber: 12,
          firstName: "Emma",
          lastName: "Johnson",
        }),
      ],
      board,
      nameFormat,
      unnamedLabel: "Unnamed",
    });

    expect(items[0]?.studentLabel).toBe("Emma J. #12 (Team A)");
  });

  it("joins multiple students on one desk", () => {
    const studentB = "s2" as Id<"users">;
    const items = buildSeatChartPrintItems({
      layoutItems: [deskItem("d1")],
      assignments: [
        { deskItemId: "d1", groupId, studentUserId: studentId },
        { deskItemId: "d1", groupId: "g2" as Id<"groups">, studentUserId: studentB },
      ],
      roster: [
        student({
          userId: studentId,
          rosterNumber: 12,
          firstName: "Emma",
          lastName: "Johnson",
        }),
        student({
          userId: studentB,
          rosterNumber: 3,
          firstName: "Blake",
          lastName: "Lee",
        }),
      ],
      board: {
        groups: [
          { _id: groupId, name: "Team A" },
          { _id: "g2" as Id<"groups">, name: "Team B" },
        ],
      } as unknown as GroupsBoard,
      nameFormat,
      unnamedLabel: "Unnamed",
    });

    expect(items[0]?.studentLabel).toBe("Emma J. #12 (Team A) · Blake L. #3 (Team B)");
  });
});
