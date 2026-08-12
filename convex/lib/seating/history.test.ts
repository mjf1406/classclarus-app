import { describe, expect, it } from "vite-plus/test";

import type { Doc, Id } from "../../_generated/dataModel.js";
import { buildLayoutHistoryStats } from "./history.js";

describe("buildLayoutHistoryStats", () => {
  it("accumulates every recorded dimension by student", () => {
    const studentUserId = "student" as Id<"users">;
    const neighborId = "neighbor" as Id<"users">;
    const rows = [
      { studentUserId, dimension: "total", key: "total", count: 2 },
      { studentUserId, dimension: "seat", key: "layout:desk", count: 1 },
      { studentUserId, dimension: "seat", key: "layout:desk", count: 2 },
      { studentUserId, dimension: "zone", key: "Front", count: 3 },
      { studentUserId, dimension: "team", key: "name:Blue", count: 4 },
      { studentUserId, dimension: "neighbor", key: neighborId, count: 5 },
      { studentUserId, dimension: "combination", key: "combo", count: 6 },
    ] satisfies Array<
      Pick<Doc<"seatLayoutAggregates">, "studentUserId" | "dimension" | "key" | "count">
    >;
    const stats = buildLayoutHistoryStats(rows).byStudent.get(studentUserId)!;

    expect(stats.total).toBe(2);
    expect(stats.seat.get("layout:desk")).toBe(3);
    expect(stats.zone.get("Front")).toBe(3);
    expect(stats.team.get("name:Blue")).toBe(4);
    expect(stats.neighbor.get(neighborId)).toBe(5);
    expect(stats.combination.get("combo")).toBe(6);
  });
});
