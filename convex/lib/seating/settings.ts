import type { GenderParityMode, SeatingFairnessDimension } from "./types.js";

/** Strict solver priority. Later dimensions may improve only when all earlier ones tie. */
export const SEATING_FAIRNESS_PRIORITY: ReadonlyArray<SeatingFairnessDimension> = [
  "neighbor",
  "seat",
  "zone",
  "team",
];

export function normalizeGenderParityMode(mode: GenderParityMode | undefined): GenderParityMode {
  return mode === "off" ? "off" : "oddEven";
}

/**
 * Resolve a layout's gender parity.
 * Missing field → oddEven (legacy class-level default) until backfill writes an explicit value.
 * New blank layouts always persist `{ mode: "off" }`.
 */
export function resolveLayoutGenderParityMode(
  genderParity: { mode: GenderParityMode } | undefined,
): GenderParityMode {
  return normalizeGenderParityMode(genderParity?.mode);
}
