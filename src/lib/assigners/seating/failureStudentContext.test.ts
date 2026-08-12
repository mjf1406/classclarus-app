import { describe, expect, test } from "vite-plus/test";

import type { Id } from "../../../../convex/_generated/dataModel";
import {
  buildFailureStudentNameResolver,
  classifyStudentAvailability,
} from "@/lib/assigners/seating/failureStudentContext";
import type { BoardGroup, GroupsBoard } from "@/lib/groups/groups";
import { DEFAULT_ROSTER_NAME_FORMAT } from "@/lib/roster/roster";

const groupId = "group" as Id<"groups">;

function group(partial: Pick<BoardGroup, "_id" | "name" | "students" | "teams">): BoardGroup {
  return {
    ...partial,
    description: undefined,
    icon: undefined,
    imageFileId: undefined,
    updatedAt: 1,
  };
}

function boardWithUngrouped(userId: Id<"users">): GroupsBoard {
  return {
    groups: [],
    ungrouped: [
      {
        userId,
        firstName: "Alex",
        lastName: "Example",
        rosterNumber: 1,
      },
    ],
  };
}

describe("classifyStudentAvailability", () => {
  test("marks ungrouped students", () => {
    const userId = "student" as Id<"users">;
    const board = boardWithUngrouped(userId);
    const result = classifyStudentAvailability(userId, board, new Set([userId]), new Set());
    expect(result.availability).toBe("ungrouped");
  });

  test("marks students in solver pool", () => {
    const userId = "student" as Id<"users">;
    const board: GroupsBoard = {
      ungrouped: [],
      groups: [
        group({
          _id: groupId,
          name: "Group A",
          students: [{ userId, firstName: "A", lastName: "B", rosterNumber: 1 }],
          teams: [],
        }),
      ],
    };
    const result = classifyStudentAvailability(userId, board, new Set([userId]), new Set([userId]));
    expect(result.availability).toBe("inSolverPool");
    expect(result.groupName).toBe("Group A");
  });

  test("prefers stale roster over solver pool membership", () => {
    const userId = "student" as Id<"users">;
    const board: GroupsBoard = {
      ungrouped: [],
      groups: [
        group({
          _id: groupId,
          name: "Group A",
          students: [{ userId, firstName: "A", lastName: "B", rosterNumber: 1 }],
          teams: [],
        }),
      ],
    };
    const result = classifyStudentAvailability(userId, board, new Set(), new Set([userId]));
    expect(result.availability).toBe("staleRoster");
    expect(result.groupName).toBe("Group A");
  });

  test("marks students absent from roster and board as stale roster", () => {
    const userId = "missing" as Id<"users">;
    const board: GroupsBoard = { groups: [], ungrouped: [] };
    const result = classifyStudentAvailability(userId, board, new Set(), new Set());
    expect(result.availability).toBe("staleRoster");
  });
});

describe("buildFailureStudentNameResolver", () => {
  test("falls back to board names when roster rows are missing", () => {
    const userId = "student" as Id<"users">;
    const board: GroupsBoard = {
      ungrouped: [],
      groups: [
        group({
          _id: groupId,
          name: "Group A",
          students: [{ userId, firstName: "Board", lastName: "Student", rosterNumber: 1 }],
          teams: [],
        }),
      ],
    };
    const studentName = buildFailureStudentNameResolver({
      board,
      roster: [],
      nameFormat: DEFAULT_ROSTER_NAME_FORMAT,
      unnamed: "Unnamed",
      removedLabel: "Removed student",
    });
    expect(studentName(userId)).toBe("Board Student");
  });

  test("uses removed label when student is absent from roster and board", () => {
    const studentName = buildFailureStudentNameResolver({
      board: { groups: [], ungrouped: [] },
      roster: [],
      nameFormat: DEFAULT_ROSTER_NAME_FORMAT,
      unnamed: "Unnamed",
      removedLabel: "Removed student",
    });
    expect(studentName("missing" as Id<"users">)).toBe("Removed student");
  });
});
