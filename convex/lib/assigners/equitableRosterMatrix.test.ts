import { describe, expect, it } from "vite-plus/test";

import { buildEquitableRosterMatrixCounts } from "../../../convex/lib/assigners/equitableRosterMatrix";

describe("buildEquitableRosterMatrixCounts", () => {
  it("counts assignments per current item for each student", () => {
    const result = buildEquitableRosterMatrixCounts(
      ["Line leader", "Cleanup"],
      ["u1" as never, "u2" as never],
      [
        { studentUserId: "u1", item: "Line leader" },
        { studentUserId: "u1", item: "Line leader" },
        { studentUserId: "u1", item: "Cleanup" },
        { studentUserId: "u2", item: "Cleanup" },
        { studentUserId: "u2", item: "Retired item" },
      ],
    );

    expect(result).toEqual([
      {
        studentUserId: "u1",
        counts: [
          { item: "Line leader", count: 2 },
          { item: "Cleanup", count: 1 },
        ],
      },
      {
        studentUserId: "u2",
        counts: [
          { item: "Line leader", count: 0 },
          { item: "Cleanup", count: 1 },
        ],
      },
    ]);
  });

  it("returns zero counts when there is no history", () => {
    const result = buildEquitableRosterMatrixCounts(["A"], ["u1" as never], []);

    expect(result).toEqual([
      {
        studentUserId: "u1",
        counts: [{ item: "A", count: 0 }],
      },
    ]);
  });
});
