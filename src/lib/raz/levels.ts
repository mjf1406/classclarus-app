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

export type RazManualStatus = "rti" | "pending" | "ineligible";

export const RAZ_MANUAL_STATUSES = [
  "rti",
  "pending",
  "ineligible",
] as const satisfies readonly RazManualStatus[];

export function isRazManualStatus(value: string): value is RazManualStatus {
  return (RAZ_MANUAL_STATUSES as readonly string[]).includes(value);
}

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

export type RazAssessmentEntry = {
  _id: string;
  studentUserId: string;
  assessedAt: number;
  readAccuracy: number;
  retellScore: number | null;
  respondScore: number;
  result: "level_up" | "stay" | "level_down";
  level: string;
  note: string | null;
};
