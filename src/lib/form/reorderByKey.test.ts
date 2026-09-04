import { describe, expect, test } from "vite-plus/test";

import { reorderByKey } from "./reorderByKey";

const items = [
  { key: "a", text: "first" },
  { key: "b", text: "second" },
  { key: "c", text: "third" },
];

describe("reorderByKey", () => {
  test("moves an item to a new index", () => {
    expect(reorderByKey(items, "a", "c")).toEqual([
      { key: "b", text: "second" },
      { key: "c", text: "third" },
      { key: "a", text: "first" },
    ]);
  });

  test("returns null when the drop target is the same item", () => {
    expect(reorderByKey(items, "b", "b")).toBeNull();
  });

  test("returns null when an id is unknown", () => {
    expect(reorderByKey(items, "a", "missing")).toBeNull();
    expect(reorderByKey(items, "missing", "b")).toBeNull();
  });

  test("preserves the full item object", () => {
    const linked = [
      { key: "one", text: "Read", assignmentId: "asg1", preface: "Center 1" },
      { key: "two", text: "Write", taskId: "task1" },
    ];
    expect(reorderByKey(linked, "two", "one")).toEqual([
      { key: "two", text: "Write", taskId: "task1" },
      { key: "one", text: "Read", assignmentId: "asg1", preface: "Center 1" },
    ]);
  });
});
