import levelsJson from "./levels.json";

export type RazLevelMeta = {
  Grade: string;
  "Lexile Measure": string;
  Category: string;
  LowerBoundDays: number;
  UpperBoundDays: number;
  ScheduleText: string;
};

export type RazLevel = keyof typeof levelsJson;

/** Ordered RAZ level keys matching `levels.json` insertion order. */
export const RAZ_LEVEL_KEYS = Object.keys(levelsJson) as RazLevel[];

const RAZ_LEVEL_SET = new Set<string>(RAZ_LEVEL_KEYS);

export const RAZ_LEVELS = levelsJson as Record<RazLevel, RazLevelMeta>;

export function isRazLevel(value: string): value is RazLevel {
  return RAZ_LEVEL_SET.has(value);
}

export type RazManualStatus = "rti" | "pending";

export type RazInitialLevelEntry = {
  studentUserId: string;
  initialLevel: string;
  currentLevel: string;
  lastAssessedAt: number | null;
  /** Latest assessment result, or null when none recorded yet. */
  lastAssessmentResult: "level_up" | "stay" | "level_down" | null;
  scheduleAnchorAt: number;
  manualStatus: RazManualStatus | null;
};
