import { describe, expect, test } from "vitest";

import {
  normalizeGenderParityMode,
  resolveLayoutGenderParityMode,
  SEATING_FAIRNESS_PRIORITY,
} from "./settings.js";

describe("SEATING_FAIRNESS_PRIORITY", () => {
  test("uses the immutable lexicographic priority", () => {
    expect(SEATING_FAIRNESS_PRIORITY).toEqual(["neighbor", "seat", "zone", "team"]);
  });
});

describe("normalizeGenderParityMode", () => {
  test("defaults missing values to oddEven", () => {
    expect(normalizeGenderParityMode(undefined)).toBe("oddEven");
    expect(normalizeGenderParityMode("oddEven")).toBe("oddEven");
    expect(normalizeGenderParityMode("off")).toBe("off");
  });
});

describe("resolveLayoutGenderParityMode", () => {
  test("treats missing layout field as oddEven until backfill", () => {
    expect(resolveLayoutGenderParityMode(undefined)).toBe("oddEven");
  });

  test("preserves explicit off and oddEven", () => {
    expect(resolveLayoutGenderParityMode({ mode: "off" })).toBe("off");
    expect(resolveLayoutGenderParityMode({ mode: "oddEven" })).toBe("oddEven");
  });
});
