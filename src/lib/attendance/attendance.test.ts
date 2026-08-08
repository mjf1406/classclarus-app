import { describe, expect, test } from "vite-plus/test";

import {
  cycleAttendanceStatus,
  draftForRoster,
  draftFromRecords,
  greatestCommonDivisor,
  isAttendanceDraftDirty,
  recordsPayloadFromDraft,
  simplifyRatio,
  summarizeAttendanceCounts,
  summarizeAttendanceStatuses,
  type AttendanceRecord,
} from "@/lib/attendance/attendance";
import { isValidDateKey, localDateKey } from "@/lib/attendance/dateKey";
import type { Id } from "../../../convex/_generated/dataModel";

describe("localDateKey", () => {
  test("formats local calendar day as YYYY-MM-DD", () => {
    const key = localDateKey(new Date(2026, 7, 7, 23, 30, 0));
    expect(key).toBe("2026-08-07");
    expect(isValidDateKey(key)).toBe(true);
  });

  test("rejects invalid keys", () => {
    expect(isValidDateKey("2026-8-7")).toBe(false);
    expect(isValidDateKey("not-a-date")).toBe(false);
  });
});

describe("cycleAttendanceStatus", () => {
  test("cycles unset → present → absent → late → present", () => {
    expect(cycleAttendanceStatus("unset")).toBe("present");
    expect(cycleAttendanceStatus("present")).toBe("absent");
    expect(cycleAttendanceStatus("absent")).toBe("late");
    expect(cycleAttendanceStatus("late")).toBe("present");
  });
});

describe("attendance draft helpers", () => {
  const records = [
    {
      _id: "r1" as Id<"attendanceRecords">,
      _creationTime: 1,
      classId: "c1" as Id<"classes">,
      sessionId: "s1" as Id<"attendanceSessions">,
      dateKey: "2026-08-07",
      studentUserId: "u1" as Id<"users">,
      status: "present" as const,
      updatedAt: 1,
      updatedBy: "t1" as Id<"users">,
    },
  ] satisfies AttendanceRecord[];

  test("draftFromRecords and dirty detection", () => {
    const draft = draftFromRecords(records);
    expect(draft).toEqual({ u1: "present" });
    expect(isAttendanceDraftDirty(draft, records)).toBe(false);
    expect(isAttendanceDraftDirty({ u1: "absent" }, records)).toBe(true);
    expect(isAttendanceDraftDirty({}, records)).toBe(true);
  });

  test("draftForRoster defaults everyone to present and overlays saved statuses", () => {
    const draft = draftForRoster(["u1", "u2"], [{ ...records[0]!, status: "absent" }]);
    expect(draft).toEqual({ u1: "absent", u2: "present" });
    expect(isAttendanceDraftDirty(draft, [])).toBe(true);
    expect(isAttendanceDraftDirty(draftForRoster(["u1"], records), records)).toBe(false);
  });

  test("recordsPayloadFromDraft", () => {
    expect(recordsPayloadFromDraft({ u1: "late" })).toEqual([
      { studentUserId: "u1", status: "late" },
    ]);
  });
});

describe("simplifyRatio", () => {
  test("reduces by greatest common divisor", () => {
    expect(greatestCommonDivisor(12, 8)).toBe(4);
    expect(simplifyRatio(12, 8)).toEqual({ numerator: 3, denominator: 2 });
    expect(simplifyRatio(15, 5)).toEqual({ numerator: 3, denominator: 1 });
    expect(simplifyRatio(5, 0)).toEqual({ numerator: 1, denominator: 0 });
    expect(simplifyRatio(0, 4)).toEqual({ numerator: 0, denominator: 1 });
    expect(simplifyRatio(0, 0)).toEqual({ numerator: 0, denominator: 0 });
  });
});

describe("summarizeAttendanceStatuses", () => {
  test("counts late as present for percent and ratio", () => {
    expect(
      summarizeAttendanceStatuses(["present", "present", "late", "absent", "absent", "present"]),
    ).toEqual({
      present: 4,
      absent: 2,
      late: 1,
      total: 6,
      percentPresent: 67,
      ratio: { present: 2, absent: 1 },
    });
  });

  test("returns zeros when empty", () => {
    expect(summarizeAttendanceStatuses([])).toEqual({
      present: 0,
      absent: 0,
      late: 0,
      total: 0,
      percentPresent: 0,
      ratio: { present: 0, absent: 0 },
    });
  });

  test("summarizeAttendanceCounts accepts pre-aggregated totals", () => {
    expect(summarizeAttendanceCounts({ present: 4, absent: 2, late: 1 })).toEqual({
      present: 4,
      absent: 2,
      late: 1,
      total: 6,
      percentPresent: 67,
      ratio: { present: 2, absent: 1 },
    });
  });
});
