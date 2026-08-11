import { v } from "convex/values";

import type { SeatAlgorithmSettings, SeatingWeightKey, SeatingWeights } from "./types.js";

export const SEATING_WEIGHT_KEYS: ReadonlyArray<SeatingWeightKey> = [
  "seat",
  "zone",
  "team",
  "neighbor",
  "gender",
  "combination",
];

export const DEFAULT_SEATING_WEIGHTS: SeatingWeights = {
  seat: 40,
  zone: 40,
  team: 60,
  neighbor: 50,
  gender: 30,
  combination: 35,
};

export const DEFAULT_SEAT_ALGORITHM_SETTINGS: SeatAlgorithmSettings = {
  weights: DEFAULT_SEATING_WEIGHTS,
  genderParity: {
    mode: "oddEven",
  },
};

const MIN_WEIGHT = 0;
const MAX_WEIGHT = 100;

function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, Math.round(value)));
}

export function normalizeSeatingWeights(weights: Partial<SeatingWeights>): SeatingWeights {
  const normalized = { ...DEFAULT_SEATING_WEIGHTS };
  for (const key of SEATING_WEIGHT_KEYS) {
    const value = weights[key];
    if (value !== undefined) {
      normalized[key] = clampWeight(value);
    }
  }
  return normalized;
}

export function normalizeSeatAlgorithmSettings(
  settings: Partial<SeatAlgorithmSettings> | undefined,
): SeatAlgorithmSettings {
  if (!settings) return DEFAULT_SEAT_ALGORITHM_SETTINGS;
  const mode = settings.genderParity?.mode === "off" ? "off" : "oddEven";
  return {
    weights: normalizeSeatingWeights(settings.weights ?? {}),
    genderParity: { mode },
  };
}

export function copySeatAlgorithmSettings(source: SeatAlgorithmSettings): SeatAlgorithmSettings {
  return normalizeSeatAlgorithmSettings(source);
}

export const seatingWeightsValidator = v.object({
  seat: v.number(),
  zone: v.number(),
  team: v.number(),
  neighbor: v.number(),
  gender: v.number(),
  combination: v.number(),
});

export const seatAlgorithmSettingsValidator = v.object({
  weights: seatingWeightsValidator,
  genderParity: v.object({
    mode: v.union(v.literal("off"), v.literal("oddEven")),
  }),
});

export const seatAlgorithmSettingsDocValidator = v.object({
  _id: v.id("seatAlgorithmSettings"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  weights: seatingWeightsValidator,
  genderParity: v.object({
    mode: v.union(v.literal("off"), v.literal("oddEven")),
  }),
  updatedAt: v.number(),
  updatedBy: v.id("users"),
});
