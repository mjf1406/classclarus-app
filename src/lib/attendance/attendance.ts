import type { Id } from "../../../convex/_generated/dataModel";

export const ATTENDANCE_STATUSES = ["present", "absent", "late"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type AttendanceDraftStatus = AttendanceStatus | "unset";

export type AttendanceRecord = {
  _id: Id<"attendanceRecords">;
  _creationTime: number;
  classId: Id<"classes">;
  sessionId: Id<"attendanceSessions">;
  dateKey: string;
  studentUserId: Id<"users">;
  status: AttendanceStatus;
  updatedAt: number;
  updatedBy: Id<"users">;
};

export type AttendanceSession = {
  _id: Id<"attendanceSessions">;
  _creationTime: number;
  classId: Id<"classes">;
  dateKey: string;
  takenBy: Id<"users">;
  createdAt: number;
  updatedAt: number;
};

export type AttendanceForDate = {
  session: AttendanceSession | null;
  records: AttendanceRecord[];
};

/** unset → present → absent → late → present */
export function cycleAttendanceStatus(current: AttendanceDraftStatus): AttendanceStatus {
  if (current === "unset" || current === "late") return "present";
  if (current === "present") return "absent";
  return "late";
}

export function draftFromRecords(
  records: readonly AttendanceRecord[],
): Record<string, AttendanceStatus> {
  const draft: Record<string, AttendanceStatus> = {};
  for (const record of records) {
    draft[record.studentUserId] = record.status;
  }
  return draft;
}

/**
 * Default every roster student to present, then overlay any saved statuses.
 * Fresh days start all-present and dirty vs an empty server session.
 */
export function draftForRoster(
  studentUserIds: readonly string[],
  records: readonly AttendanceRecord[],
): Record<string, AttendanceStatus> {
  const draft: Record<string, AttendanceStatus> = {};
  for (const userId of studentUserIds) {
    draft[userId] = "present";
  }
  for (const record of records) {
    if (Object.hasOwn(draft, record.studentUserId)) {
      draft[record.studentUserId] = record.status;
    }
  }
  return draft;
}

export function recordsPayloadFromDraft(
  draft: Readonly<Record<string, AttendanceStatus>>,
): Array<{ studentUserId: Id<"users">; status: AttendanceStatus }> {
  return Object.entries(draft).map(([studentUserId, status]) => ({
    studentUserId: studentUserId as Id<"users">,
    status,
  }));
}

export function isAttendanceDraftDirty(
  draft: Readonly<Record<string, AttendanceStatus>>,
  records: readonly AttendanceRecord[],
): boolean {
  const baseline = draftFromRecords(records);
  const draftKeys = Object.keys(draft);
  const baselineKeys = Object.keys(baseline);
  if (draftKeys.length !== baselineKeys.length) return true;
  for (const key of draftKeys) {
    if (draft[key] !== baseline[key]) return true;
  }
  return false;
}

/** Euclidean GCD; `gcd(n, 0) === n`. */
export function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

/** Reduce a ratio to lowest terms (e.g. 12:8 → 3:2, 5:0 → 1:0). */
export function simplifyRatio(
  numerator: number,
  denominator: number,
): { numerator: number; denominator: number } {
  const n = Math.max(0, Math.trunc(numerator));
  const d = Math.max(0, Math.trunc(denominator));
  if (n === 0 && d === 0) {
    return { numerator: 0, denominator: 0 };
  }
  const divisor = greatestCommonDivisor(n, d);
  return { numerator: n / divisor, denominator: d / divisor };
}

export type AttendanceStatusSummary = {
  /** Days counted as attended (`present` + `late`). */
  present: number;
  absent: number;
  late: number;
  total: number;
  /** 0–100; 0 when there are no recorded days. */
  percentPresent: number;
  ratio: { present: number; absent: number };
};

/** Build a summary from pre-aggregated counts. `present` is attended (includes late). */
export function summarizeAttendanceCounts(args: {
  present: number;
  absent: number;
  late?: number;
}): AttendanceStatusSummary {
  const present = Math.max(0, Math.trunc(args.present));
  const absent = Math.max(0, Math.trunc(args.absent));
  const late = Math.max(0, Math.trunc(args.late ?? 0));
  const total = present + absent;
  const percentPresent = total === 0 ? 0 : Math.round((present / total) * 100);
  const ratio = simplifyRatio(present, absent);
  return {
    present,
    absent,
    late,
    total,
    percentPresent,
    ratio: { present: ratio.numerator, absent: ratio.denominator },
  };
}

/** Aggregate attendance statuses. Late counts as present for rate/ratio. */
export function summarizeAttendanceStatuses(
  statuses: readonly AttendanceStatus[],
): AttendanceStatusSummary {
  let presentOnly = 0;
  let absent = 0;
  let late = 0;
  for (const status of statuses) {
    if (status === "present") presentOnly += 1;
    else if (status === "absent") absent += 1;
    else late += 1;
  }
  return summarizeAttendanceCounts({
    present: presentOnly + late,
    absent,
    late,
  });
}
