import { describe, expect, it } from "vite-plus/test";

import type { Id } from "../../_generated/dataModel.js";
import { matchesLayoutHistoryDimension } from "./layoutStudentHistory.js";

const layoutId = "layout1" as Id<"seatLayouts">;
const neighborA = "neighborA" as Id<"users">;
const neighborB = "neighborB" as Id<"users">;

const row = {
  deskItemId: "desk-1",
  zoneName: "Front",
  teamKey: "name:One",
  neighborStudentIds: [neighborA, neighborB],
};

describe("matchesLayoutHistoryDimension", () => {
  it("matches seat keys scoped to the layout", () => {
    expect(matchesLayoutHistoryDimension(row, layoutId, "seat", "layout1:desk-1")).toBe(true);
    expect(matchesLayoutHistoryDimension(row, layoutId, "seat", "layout1:desk-2")).toBe(false);
  });

  it("matches zone name", () => {
    expect(matchesLayoutHistoryDimension(row, layoutId, "zone", "Front")).toBe(true);
    expect(matchesLayoutHistoryDimension(row, layoutId, "zone", "Back")).toBe(false);
  });

  it("matches team key", () => {
    expect(matchesLayoutHistoryDimension(row, layoutId, "team", "name:One")).toBe(true);
    expect(matchesLayoutHistoryDimension(row, layoutId, "team", "name:Two")).toBe(false);
  });

  it("matches neighbor user ids", () => {
    expect(matchesLayoutHistoryDimension(row, layoutId, "neighbor", neighborA)).toBe(true);
    expect(matchesLayoutHistoryDimension(row, layoutId, "neighbor", "other" as Id<"users">)).toBe(
      false,
    );
  });

  it("does not match missing optional zone or team", () => {
    const bare = { deskItemId: "desk-1", neighborStudentIds: [] as Array<Id<"users">> };
    expect(matchesLayoutHistoryDimension(bare, layoutId, "zone", "Front")).toBe(false);
    expect(matchesLayoutHistoryDimension(bare, layoutId, "team", "name:One")).toBe(false);
  });
});
