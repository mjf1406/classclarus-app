import { isRazLevel, RAZ_LEVELS, type RazLevelMeta, type RazManualStatus } from "@/lib/raz/levels";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days before window start that count as "coming soon". */
export const COMING_SOON_DAYS = 7;

export type RazScheduleStatus = "overdue" | "due_now" | "coming_soon" | "up_to_date";

export type RazDisplayStatus = RazManualStatus | RazScheduleStatus;

export const RAZ_DISPLAY_STATUSES = [
  "rti",
  "pending",
  "overdue",
  "due_now",
  "coming_soon",
  "up_to_date",
] as const satisfies readonly RazDisplayStatus[];

export type RazAssessmentSchedule = {
  lowerBoundDays: number;
  upperBoundDays: number;
  scheduleText: string;
  /** First day the reassessment window opens. */
  windowStartAt: number;
  /** Last day the reassessment window closes. */
  windowEndAt: number;
  /**
   * Calendar days until the next due moment:
   * - upcoming / coming soon / up to date → days until window start
   * - due_now → 0
   * - overdue → negative days past window end
   */
  daysUntilDue: number;
  /** Schedule-only status (ignores manual overrides). */
  scheduleStatus: RazScheduleStatus;
};

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(timestampMs: number, days: number): number {
  const date = new Date(timestampMs);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime();
}

/** Whole calendar-day distance from `from` to `to` (local midnight). */
export function calendarDayDiff(fromMs: number, toMs: number): number {
  return Math.round(
    (startOfLocalDay(new Date(toMs)).getTime() - startOfLocalDay(new Date(fromMs)).getTime()) /
      DAY_MS,
  );
}

export function getRazLevelScheduleMeta(level: string): RazLevelMeta | null {
  if (!isRazLevel(level)) return null;
  return RAZ_LEVELS[level];
}

export type GetRazAssessmentScheduleOptions = {
  /**
   * Force overdue (immediate retest) — used for RTI and for students who
   * only have an initial level with no assessments yet.
   */
  forceOverdue?: boolean;
};

/**
 * Build the RAZ reassessment window from a level + anchor timestamp
 * (`lastAssessedAt`, or level-row `updatedAt` when never assessed).
 *
 * Students with an initial level but no assessment records are overdue
 * (first assessment missing), not waiting for the reassessment window.
 * RTI also forces overdue (immediate retest).
 */
export function getRazAssessmentSchedule(
  level: string,
  scheduleAnchorAt: number,
  nowMs: number = Date.now(),
  lastAssessedAt?: number | null,
  options?: GetRazAssessmentScheduleOptions,
): RazAssessmentSchedule | null {
  const meta = getRazLevelScheduleMeta(level);
  if (!meta) return null;
  if (!Number.isFinite(scheduleAnchorAt)) return null;

  // Initial level only, or RTI immediate retest — overdue until assessed again.
  if (lastAssessedAt === null || options?.forceOverdue) {
    const today = startOfLocalDay(new Date(nowMs)).getTime();
    return {
      lowerBoundDays: meta.LowerBoundDays,
      upperBoundDays: meta.UpperBoundDays,
      scheduleText: meta.ScheduleText,
      windowStartAt: today,
      windowEndAt: today,
      daysUntilDue: -1,
      scheduleStatus: "overdue",
    };
  }

  const windowStartAt = addLocalDays(scheduleAnchorAt, meta.LowerBoundDays);
  const windowEndAt = addLocalDays(scheduleAnchorAt, meta.UpperBoundDays);
  const daysUntilStart = calendarDayDiff(nowMs, windowStartAt);
  const daysUntilEnd = calendarDayDiff(nowMs, windowEndAt);

  let scheduleStatus: RazScheduleStatus;
  let daysUntilDue: number;
  if (daysUntilStart > 0) {
    scheduleStatus = daysUntilStart <= COMING_SOON_DAYS ? "coming_soon" : "up_to_date";
    daysUntilDue = daysUntilStart;
  } else if (daysUntilEnd >= 0) {
    scheduleStatus = "due_now";
    daysUntilDue = 0;
  } else {
    scheduleStatus = "overdue";
    daysUntilDue = daysUntilEnd;
  }

  return {
    lowerBoundDays: meta.LowerBoundDays,
    upperBoundDays: meta.UpperBoundDays,
    scheduleText: meta.ScheduleText,
    windowStartAt,
    windowEndAt,
    daysUntilDue,
    scheduleStatus,
  };
}

export type GetRazDisplayStatusArgs = {
  level: string;
  scheduleAnchorAt: number;
  /** Null when the student has never been assessed (initial level only). */
  lastAssessedAt?: number | null;
  manualStatus?: RazManualStatus | null;
  nowMs?: number;
};

/**
 * Display statuses with manual overrides first (RTI → pending), then schedule.
 *
 * RTI is the only case that returns two statuses: `["rti", "overdue"]`
 * (immediate retest). All other cases return a single status.
 */
export function getRazDisplayStatuses({
  level,
  scheduleAnchorAt,
  lastAssessedAt,
  manualStatus,
  nowMs = Date.now(),
}: GetRazDisplayStatusArgs): RazDisplayStatus[] {
  if (manualStatus === "pending") {
    return ["pending"];
  }
  if (manualStatus === "rti") {
    return ["rti", "overdue"];
  }
  const schedule = getRazAssessmentSchedule(level, scheduleAnchorAt, nowMs, lastAssessedAt);
  return schedule ? [schedule.scheduleStatus] : [];
}

/**
 * Primary display status (first of {@link getRazDisplayStatuses}), or null.
 */
export function getRazDisplayStatus(args: GetRazDisplayStatusArgs): RazDisplayStatus | null {
  return getRazDisplayStatuses(args)[0] ?? null;
}

/** Reason key for the status-cell help tip body copy. */
export type RazStatusExplanationReason =
  | "rti"
  | "pending"
  | "overdue_never_assessed"
  | "overdue_window"
  | "due_now"
  | "coming_soon"
  | "up_to_date";

/**
 * Pick a plain-language explanation reason for the student's current status.
 */
export function getRazStatusExplanationReason({
  lastAssessedAt,
  manualStatus,
  scheduleStatus,
}: {
  lastAssessedAt?: number | null;
  manualStatus?: RazManualStatus | null;
  scheduleStatus: RazScheduleStatus | null;
}): RazStatusExplanationReason | null {
  if (manualStatus === "rti") return "rti";
  if (manualStatus === "pending") return "pending";
  if (scheduleStatus == null) return null;
  if (scheduleStatus === "overdue") {
    return lastAssessedAt == null ? "overdue_never_assessed" : "overdue_window";
  }
  return scheduleStatus;
}
