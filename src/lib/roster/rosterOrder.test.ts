import { describe, expect, test } from "vite-plus/test";

import { applyRosterOrder, type StudentRosterEntry } from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

function entry(userId: string, rosterNumber: number): StudentRosterEntry {
  return {
    userId: userId as Id<"users">,
    rosterNumber,
    role: "student",
  };
}

describe("applyRosterOrder", () => {
  test("rewrites dense 1-based roster numbers", () => {
    const a = entry("a", 1);
    const b = entry("b", 2);
    const c = entry("c", 3);
    expect(applyRosterOrder([a, b, c], ["c", "a", "b"] as Id<"users">[])).toEqual([
      { ...c, rosterNumber: 1 },
      { ...a, rosterNumber: 2 },
      { ...b, rosterNumber: 3 },
    ]);
  });

  test("returns null when the id set does not match", () => {
    const a = entry("a", 1);
    const b = entry("b", 2);
    expect(applyRosterOrder([a, b], ["a"] as Id<"users">[])).toBeNull();
    expect(applyRosterOrder([a, b], ["a", "x"] as Id<"users">[])).toBeNull();
  });
});
