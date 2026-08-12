import { describe, expect, test } from "vitest";

import { prepareSeatingAlgorithmInput } from "./pipeline.js";
import type { Id } from "../../_generated/dataModel.js";

describe("prepareSeatingAlgorithmInput", () => {
  test("uses layout gender parity", () => {
    const input = prepareSeatingAlgorithmInput({
      layoutId: "layout1" as Id<"seatLayouts">,
      layoutItems: [],
      lockedAssignments: [],
      randomSeed: "seed-parity",
      genderParityMode: "off",
      constraints: [],
      memberships: [],
      rosterGenderByStudent: new Map(),
      layoutAggregateRows: [],
      resolveTeamKey: () => undefined,
    });

    expect(input.genderParityMode).toBe("off");
  });

  test("normalizes oddEven parity mode", () => {
    const input = prepareSeatingAlgorithmInput({
      layoutId: "layout1" as Id<"seatLayouts">,
      layoutItems: [],
      lockedAssignments: [],
      randomSeed: "seed-parity-2",
      genderParityMode: "oddEven",
      constraints: [],
      memberships: [],
      rosterGenderByStudent: new Map(),
      layoutAggregateRows: [],
      resolveTeamKey: () => undefined,
    });

    expect(input.genderParityMode).toBe("oddEven");
  });
});
