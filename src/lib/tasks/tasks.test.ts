import { describe, expect, test } from "vite-plus/test";

import {
  computeTaskGroupCompletionStats,
  groupTasksByAssignment,
  isTaskPastDue,
  nextTaskStudentSortState,
  sortTaskStudents,
  sortTasksByProcedureStep,
  taskStudentCardNames,
  type TaskListItem,
} from "@/lib/tasks/tasks";
import { completionTone } from "@/components/tasks/taskCompletionTone";
import type { GroupsBoard } from "@/lib/groups/groups";
import type { StudentRosterEntry } from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

function stubTask(
  overrides: Partial<TaskListItem> & Pick<TaskListItem, "_id" | "name">,
): TaskListItem {
  const { completedStudentIds, ...rest } = overrides;
  return {
    _creationTime: 1,
    classId: "class1" as Id<"classes">,
    createdBy: "user1" as Id<"users">,
    createdAt: 1,
    updatedAt: 1,
    completedCount: 0,
    studentCount: 0,
    completedStudentIds: completedStudentIds ?? [],
    ...rest,
  };
}

describe("isTaskPastDue", () => {
  const noon = new Date(2026, 7, 8, 12, 0);

  test("false when no due date", () => {
    expect(isTaskPastDue(undefined, noon)).toBe(false);
  });

  test("false when due today or in the future (date-only)", () => {
    expect(isTaskPastDue("2026-08-08", noon)).toBe(false);
    expect(isTaskPastDue("2026-08-09", noon)).toBe(false);
  });

  test("true when due before today (date-only)", () => {
    expect(isTaskPastDue("2026-08-07", noon)).toBe(true);
  });

  test("compares datetime against now", () => {
    expect(isTaskPastDue("2026-08-08T11:59", noon)).toBe(true);
    expect(isTaskPastDue("2026-08-08T12:00", noon)).toBe(false);
  });
});

describe("completionTone", () => {
  test("done wins over past due", () => {
    expect(completionTone(true, true)).toBe("done");
  });

  test("late supersedes notDone when incomplete and past due", () => {
    expect(completionTone(false, true)).toBe("late");
  });

  test("notDone when incomplete and on time", () => {
    expect(completionTone(false, false)).toBe("notDone");
  });
});

describe("sortTasksByProcedureStep", () => {
  test("orders by procedure step number ascending", () => {
    const sorted = sortTasksByProcedureStep([
      stubTask({
        _id: "t3" as Id<"tasks">,
        name: "Three",
        procedureStepNumber: 3,
      }),
      stubTask({
        _id: "t1" as Id<"tasks">,
        name: "One",
        procedureStepNumber: 1,
      }),
      stubTask({
        _id: "t2" as Id<"tasks">,
        name: "Two",
        procedureStepNumber: 2,
      }),
    ]);
    expect(sorted.map((task) => task.name)).toEqual(["One", "Two", "Three"]);
  });
});

describe("groupTasksByAssignment", () => {
  test("sorts folder tasks by procedure step number", () => {
    const assignmentId = "a1" as Id<"assignments">;
    const { groups } = groupTasksByAssignment([
      stubTask({
        _id: "t2" as Id<"tasks">,
        name: "Step two",
        assignmentId,
        assignmentName: "Lab",
        procedureStepNumber: 2,
      }),
      stubTask({
        _id: "t1" as Id<"tasks">,
        name: "Step one",
        assignmentId,
        assignmentName: "Lab",
        procedureStepNumber: 1,
      }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.tasks.map((task) => task.name)).toEqual(["Step one", "Step two"]);
  });
});

const board = {
  ungrouped: [{ userId: "d" as Id<"users"> }],
  groups: [
    {
      _id: "g1" as Id<"groups">,
      name: "Alpha",
      students: [{ userId: "b" as Id<"users"> }],
      teams: [{ _id: "t1" as Id<"teams">, students: [{ userId: "a" as Id<"users"> }] }],
    },
    {
      _id: "g2" as Id<"groups">,
      name: "Beta",
      students: [],
      teams: [{ _id: "t2" as Id<"teams">, students: [{ userId: "c" as Id<"users"> }] }],
    },
  ],
} as unknown as GroupsBoard;

describe("computeTaskGroupCompletionStats", () => {
  test("counts completed students per group and ungrouped", () => {
    const stats = computeTaskGroupCompletionStats({
      board,
      completedStudentIds: new Set(["a", "c"]),
      ungroupedLabel: "Ungrouped",
    });
    expect(stats).toEqual([
      { groupId: "g1", name: "Alpha", completedCount: 1, studentCount: 2 },
      { groupId: "g2", name: "Beta", completedCount: 1, studentCount: 1 },
      { groupId: "ungrouped", name: "Ungrouped", completedCount: 0, studentCount: 1 },
    ]);
  });

  test("omits groups with no included students", () => {
    const stats = computeTaskGroupCompletionStats({
      board,
      completedStudentIds: new Set(["a"]),
      includedStudentIds: new Set(["a", "d"]),
      ungroupedLabel: "Ungrouped",
    });
    expect(stats).toEqual([
      { groupId: "g1", name: "Alpha", completedCount: 1, studentCount: 1 },
      { groupId: "ungrouped", name: "Ungrouped", completedCount: 0, studentCount: 1 },
    ]);
  });

  test("returns empty when the class has no groups", () => {
    const stats = computeTaskGroupCompletionStats({
      board: { groups: [], ungrouped: [{ userId: "d" as Id<"users"> }] } as unknown as GroupsBoard,
      completedStudentIds: new Set(["d"]),
      ungroupedLabel: "Ungrouped",
    });
    expect(stats).toEqual([]);
  });
});

describe("taskStudentCardNames", () => {
  test("uses roster first and last when both are set", () => {
    expect(
      taskStudentCardNames(
        { userId: "u1" as Id<"users">, firstName: "Ada", lastName: "Lovelace", name: "Other" },
        "Unnamed",
      ),
    ).toEqual({ firstName: "Ada", lastName: "Lovelace" });
  });

  test("falls back to display name when roster names are empty", () => {
    expect(
      taskStudentCardNames(
        { userId: "u1" as Id<"users">, name: "Ada Lovelace", email: "ada@example.com" },
        "Unnamed",
      ),
    ).toEqual({ firstName: "Ada Lovelace" });
  });
});

function stubStudent(
  partial: Partial<StudentRosterEntry> & { userId: Id<"users">; rosterNumber: number },
): StudentRosterEntry {
  return {
    userId: partial.userId,
    rosterNumber: partial.rosterNumber,
    firstName: partial.firstName,
    lastName: partial.lastName,
    name: partial.name,
    role: "student",
  };
}

describe("task student grid sort", () => {
  test("nextTaskStudentSortState toggles direction on same key", () => {
    expect(nextTaskStudentSortState("firstName", "asc", "firstName")).toEqual({
      sortKey: "firstName",
      sortDirection: "desc",
    });
  });

  test("names default asc; done default desc", () => {
    expect(nextTaskStudentSortState("rosterNumber", "asc", "firstName")).toEqual({
      sortKey: "firstName",
      sortDirection: "asc",
    });
    expect(nextTaskStudentSortState("firstName", "asc", "done")).toEqual({
      sortKey: "done",
      sortDirection: "desc",
    });
  });

  test("sorts by roster number", () => {
    const a = stubStudent({ userId: "a" as Id<"users">, rosterNumber: 2, firstName: "B" });
    const b = stubStudent({ userId: "b" as Id<"users">, rosterNumber: 1, firstName: "A" });
    expect(sortTaskStudents([a, b], "rosterNumber", "asc", new Set()).map((s) => s.userId)).toEqual(
      ["b", "a"],
    );
  });

  test("sorts done first when direction is desc", () => {
    const a = stubStudent({ userId: "a" as Id<"users">, rosterNumber: 1, firstName: "A" });
    const b = stubStudent({ userId: "b" as Id<"users">, rosterNumber: 2, firstName: "B" });
    expect(sortTaskStudents([a, b], "done", "desc", new Set(["a"])).map((s) => s.userId)).toEqual([
      "a",
      "b",
    ]);
  });
});
