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
