import { describe, expect, test } from "vitest";

import { assignGenderParity, genderBucketFromRoster } from "./gender.js";
import { SeatingAlgorithmNotImplementedError, solveSeating } from "./solve.js";
import type { SeatingAlgorithmInput } from "./types.js";

describe("genderBucketFromRoster", () => {
  test("maps binary roster values", () => {
    expect(genderBucketFromRoster("male")).toBe("m");
    expect(genderBucketFromRoster("female")).toBe("f");
    expect(genderBucketFromRoster(undefined)).toBe("unknown");
  });
});

describe("assignGenderParity", () => {
  test("is deterministic for a seed", () => {
    const a = assignGenderParity({ randomSeed: "seed-1", mode: "oddEven" });
    const b = assignGenderParity({ randomSeed: "seed-1", mode: "oddEven" });
    expect(a).toEqual(b);
  });

  test("can flip parity for different seeds", () => {
    const results = new Set<boolean>();
    for (let i = 0; i < 20; i += 1) {
      results.add(assignGenderParity({ randomSeed: `seed-${i}`, mode: "oddEven" }).malesOnOddDesks);
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

describe("solveSeating", () => {
  test("throws not implemented error", () => {
    const input = {
      layoutId: "layout" as SeatingAlgorithmInput["layoutId"],
      slots: [],
      students: [],
      locked: [],
      constraints: [],
      history: { byStudent: new Map() },
      settings: {
        weights: {
          seat: 0,
          zone: 0,
          team: 0,
          neighbor: 0,
          gender: 0,
          combination: 0,
        },
        genderParity: { mode: "off" as const },
      },
      scope: { kind: "class" as const },
      genderParityAssignment: { malesOnOddDesks: true },
      randomSeed: "test",
    } satisfies SeatingAlgorithmInput;

    expect(() => solveSeating(input)).toThrow(SeatingAlgorithmNotImplementedError);
  });
});
