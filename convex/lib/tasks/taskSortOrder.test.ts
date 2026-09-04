import { describe, expect, test } from "vite-plus/test";

import {
  compareTaskSortOrder,
  computeBackfillSortOrders,
  expectedActiveTopLevelItems,
  inheritedAssignmentSortOrder,
  nextTaskSortOrder,
  validateTopLevelReorder,
  type TaskSortable,
} from "./taskSortOrder";

function task(overrides: Partial<TaskSortable> & Pick<TaskSortable, "_id" | "name">): TaskSortable {
  return {
    updatedAt: 1,
    ...overrides,
  };
}

describe("compareTaskSortOrder", () => {
  test("orders by sortOrder ascending", () => {
    const later = task({ _id: "b", name: "B", sortOrder: 2 });
    const earlier = task({ _id: "a", name: "A", sortOrder: 1 });
    expect([later, earlier].sort(compareTaskSortOrder).map((row) => row._id)).toEqual(["a", "b"]);
  });

  test("falls back to updatedAt descending when sortOrder is missing", () => {
    const older = task({ _id: "old", name: "Old", updatedAt: 10 });
    const newer = task({ _id: "new", name: "New", updatedAt: 20 });
    expect([older, newer].sort(compareTaskSortOrder).map((row) => row._id)).toEqual(["new", "old"]);
  });
});

describe("nextTaskSortOrder", () => {
  test("returns 0 when there are no tasks", () => {
    expect(nextTaskSortOrder([])).toBe(0);
  });

  test("appends after the current max", () => {
    expect(nextTaskSortOrder([{ sortOrder: 2 }, { sortOrder: 0 }])).toBe(3);
  });
});

describe("inheritedAssignmentSortOrder", () => {
  test("returns the first matching folder position", () => {
    expect(
      inheritedAssignmentSortOrder(
        [
          { assignmentId: "a1", sortOrder: 4 },
          { assignmentId: "a1", sortOrder: 4 },
        ],
        "a1",
      ),
    ).toBe(4);
  });

  test("returns undefined when the folder has no stored order", () => {
    expect(inheritedAssignmentSortOrder([{ assignmentId: "a1" }], "a1")).toBeUndefined();
  });
});

describe("computeBackfillSortOrders", () => {
  test("puts assignment folders first by name, then ungrouped by updatedAt", () => {
    const orders = computeBackfillSortOrders([
      task({
        _id: "solo-new",
        name: "Newest solo",
        updatedAt: 30,
      }),
      task({
        _id: "quiz-1",
        name: "Quiz step",
        assignmentId: "quiz",
        assignmentName: "Quiz",
        updatedAt: 5,
      }),
      task({
        _id: "lab-2",
        name: "Lab two",
        assignmentId: "lab",
        assignmentName: "Lab",
        updatedAt: 40,
      }),
      task({
        _id: "lab-1",
        name: "Lab one",
        assignmentId: "lab",
        assignmentName: "Lab",
        updatedAt: 1,
      }),
      task({
        _id: "solo-old",
        name: "Oldest solo",
        updatedAt: 2,
      }),
    ]);
    expect(orders.get("lab-1")).toBe(0);
    expect(orders.get("lab-2")).toBe(0);
    expect(orders.get("quiz-1")).toBe(1);
    expect(orders.get("solo-new")).toBe(2);
    expect(orders.get("solo-old")).toBe(3);
  });
});

describe("validateTopLevelReorder", () => {
  const expected = expectedActiveTopLevelItems([
    task({ _id: "t1", name: "One" }),
    task({
      _id: "t2",
      name: "Two",
      assignmentId: "a1",
      assignmentName: "Lab",
    }),
    task({
      _id: "t3",
      name: "Archived",
      archivedAt: 1,
    }),
  ]);

  test("builds only active top-level items", () => {
    expect(expected).toEqual([
      { type: "task", taskId: "t1" },
      { type: "assignment", assignmentId: "a1" },
    ]);
  });

  test("accepts a complete permutation", () => {
    expect(
      validateTopLevelReorder(
        [
          { type: "assignment", assignmentId: "a1" },
          { type: "task", taskId: "t1" },
        ],
        expected,
      ),
    ).toBeNull();
  });

  test("rejects a missing or extra item", () => {
    expect(validateTopLevelReorder([{ type: "task", taskId: "t1" }], expected)).toMatch(
      /exactly once/,
    );
    expect(
      validateTopLevelReorder(
        [
          { type: "task", taskId: "t1" },
          { type: "task", taskId: "other" },
        ],
        expected,
      ),
    ).toMatch(/unknown/);
  });
});
