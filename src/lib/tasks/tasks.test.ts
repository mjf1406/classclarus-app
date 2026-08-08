import { describe, expect, test } from "vite-plus/test";

import {
  groupTasksByAssignment,
  isTaskPastDue,
  sortTasksByProcedureStep,
  type TaskListItem,
} from "@/lib/tasks/tasks";
import { completionTone } from "@/components/tasks/taskCompletionTone";
import type { Id } from "../../../convex/_generated/dataModel";

function stubTask(
  overrides: Partial<TaskListItem> & Pick<TaskListItem, "_id" | "name">,
): TaskListItem {
  return {
    _creationTime: 1,
    classId: "class1" as Id<"classes">,
    createdBy: "user1" as Id<"users">,
    createdAt: 1,
    updatedAt: 1,
    completedCount: 0,
    studentCount: 0,
    ...overrides,
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
