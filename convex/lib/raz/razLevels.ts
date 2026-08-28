/** RAZ level keys — must match `src/lib/raz/levels.json`. */
export const RAZ_LEVEL_KEYS = [
  "aa",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "Z1",
  "Z2",
] as const;

export type RazLevel = (typeof RAZ_LEVEL_KEYS)[number];

/** Highest RAZ level — students who pass this enough times become ineligible. */
export const RAZ_MAX_LEVEL: RazLevel = "Z2";

const RAZ_LEVEL_SET = new Set<string>(RAZ_LEVEL_KEYS);

export function isRazLevel(value: string): value is RazLevel {
  return RAZ_LEVEL_SET.has(value);
}
