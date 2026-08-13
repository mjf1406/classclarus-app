import { describe, expect, it } from "vite-plus/test";

import type { Id } from "../../_generated/dataModel.js";
import { seatHistoryKey, teamHistoryKey } from "./historyKeys.js";

describe("seating history keys", () => {
  it("uses layout-scoped seat keys", () => {
    expect(seatHistoryKey("layout" as Id<"seatLayouts">, "desk")).toBe("layout:desk");
  });

  it("matches recorded single-team and by-name keys", () => {
    const groupId = "group" as Id<"groups">;
    expect(
      teamHistoryKey(groupId, {
        mode: "single",
        groupId,
        teamId: "team" as Id<"teams">,
      }),
    ).toBe("g:group:t:team");
    expect(
      teamHistoryKey(groupId, {
        mode: "byName",
        teamName: " Blue ",
      }),
    ).toBe("name:Blue");
    expect(
      teamHistoryKey(groupId, {
        mode: "single",
        groupId: "other" as Id<"groups">,
        teamId: "team" as Id<"teams">,
      }),
    ).toBeUndefined();
    expect(
      teamHistoryKey(groupId, {
        mode: "byName",
        teamName: "   ",
      }),
    ).toBeUndefined();
  });
});
