import { describe, expect, test } from "vite-plus/test";

import {
  cycleAttendanceStatus,
  draftForRoster,
  draftFromRecords,
  isAttendanceDraftDirty,
  recordsPayloadFromDraft,
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
