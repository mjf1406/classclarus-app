import { describe, expect, it } from "vite-plus/test";

import {
  assignRandom,
  expandItems,
  shuffleInPlace,
  type RandomAssignRecipient,
} from "../../../convex/lib/assigners/randomAssign";

describe("expandItems", () => {
  const items = ["A", "B", "C", "D"];

  it("returns empty for zero recipients", () => {
    expect(expandItems(items, 0, true)).toEqual([]);
  });

  it("without replicates caps at item count", () => {
    const pool = expandItems(items, 10, false, () => 0);
    expect(pool).toHaveLength(4);
    expect(new Set(pool)).toEqual(new Set(items));
  });

  it("with replicates fills all recipients evenly when divisible", () => {
    const pool = expandItems(["A", "B"], 6, true, () => 0.5);
    expect(pool).toHaveLength(6);
    expect(pool.filter((x) => x === "A")).toHaveLength(3);
    expect(pool.filter((x) => x === "B")).toHaveLength(3);
  });

  it("with replicates distributes remainder to first items", () => {
    const pool = expandItems(["A", "B", "C"], 7, true, () => 0.5);
    expect(pool).toHaveLength(7);
    const counts = new Map<string, number>();
    for (const item of pool) {
      counts.set(item, (counts.get(item) ?? 0) + 1);
    }
    expect(counts.get("A")).toBe(3);
    expect(counts.get("B")).toBe(2);
    expect(counts.get("C")).toBe(2);
  });
});

describe("assignRandom", () => {
  const items = ["Chromebook 1", "Chromebook 2"];

  const classRecipients: RandomAssignRecipient[] = [
    { studentUserId: "s1" },
    { studentUserId: "s2" },
    { studentUserId: "s3" },
    { studentUserId: "s4" },
  ];

  it("class scope without replicates assigns min(students, items)", () => {
    const result = assignRandom({
      items,
      recipients: classRecipients,
      scope: "class",
      replicates: false,
      random: () => 0,
    });
    expect(result).toHaveLength(2);
    expect(result.every((row) => items.includes(row.item))).toBe(true);
  });

  it("class scope with replicates assigns all students", () => {
    const result = assignRandom({
      items,
      recipients: classRecipients,
      scope: "class",
      replicates: true,
      random: () => 0,
    });
    expect(result).toHaveLength(4);
  });

  it("groups scope assigns independently per group", () => {
    const recipients: RandomAssignRecipient[] = [
      { studentUserId: "s1", groupId: "g1", groupName: "Group 1" },
      { studentUserId: "s2", groupId: "g1", groupName: "Group 1" },
      { studentUserId: "s3", groupId: "g2", groupName: "Group 2" },
    ];
    const result = assignRandom({
      items: ["X"],
      recipients,
      scope: "groups",
      replicates: true,
      random: () => 0,
    });
    expect(result).toHaveLength(3);
    expect(result.filter((row) => row.groupId === "g1")).toHaveLength(2);
    expect(result.filter((row) => row.groupId === "g2")).toHaveLength(1);
  });

  it("groups scope skips ungrouped students", () => {
    const recipients: RandomAssignRecipient[] = [
      { studentUserId: "s1", groupId: "g1", groupName: "Group 1" },
      { studentUserId: "s2" },
    ];
    const result = assignRandom({
      items: ["X"],
      recipients,
      scope: "groups",
      replicates: true,
      random: () => 0,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.studentUserId).toBe("s1");
  });
});

describe("shuffleInPlace", () => {
  it("is deterministic with seeded random", () => {
    const a = shuffleInPlace([1, 2, 3, 4], () => 0);
    const b = shuffleInPlace([1, 2, 3, 4], () => 0);
    expect(a).toEqual(b);
  });
});
