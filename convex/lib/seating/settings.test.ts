import { describe, expect, test } from "vitest";

import {
  DEFAULT_SEAT_ALGORITHM_SETTINGS,
  normalizeSeatAlgorithmSettings,
  normalizeSeatingWeights,
} from "./settings.js";

describe("normalizeSeatingWeights", () => {
  test("fills missing keys with defaults", () => {
    expect(normalizeSeatingWeights({ seat: 10 })).toMatchObject({
      seat: 10,
      zone: DEFAULT_SEAT_ALGORITHM_SETTINGS.weights.zone,
    });
  });

  test("clamps values to 0-100", () => {
    expect(normalizeSeatingWeights({ gender: 500, neighbor: -5 }).gender).toBe(100);
    expect(normalizeSeatingWeights({ gender: 500, neighbor: -5 }).neighbor).toBe(0);
  });
});

describe("normalizeSeatAlgorithmSettings", () => {
  test("returns defaults when undefined", () => {
    expect(normalizeSeatAlgorithmSettings(undefined)).toEqual(DEFAULT_SEAT_ALGORITHM_SETTINGS);
  });
});
