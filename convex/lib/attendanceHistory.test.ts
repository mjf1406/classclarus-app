import { describe, expect, test } from "vite-plus/test";

import type { Id } from "../_generated/dataModel.js";
import {
  isHistoryRowAfterCursor,
  mergeAttendanceHistoryPage,
  type AttendanceHistoryRow,
} from "./attendanceHistory";

const s1 = "student_1" as Id<"users">;
const s2 = "student_2" as Id<"users">;

function row(
  dateKey: string,
  studentUserId: Id<"users">,
  status: AttendanceHistoryRow["status"] = "present",
): AttendanceHistoryRow {
  return { dateKey, studentUserId, status };
}

describe("attendanceHistory", () => {
  test("isHistoryRowAfterCursor uses newest-first compound order", () => {
    const cursor = { dateKey: "2026-08-09", studentUserId: s1 };
    expect(isHistoryRowAfterCursor(row("2026-08-08", s1), cursor)).toBe(true);
    expect(isHistoryRowAfterCursor(row("2026-08-09", s2), cursor)).toBe(true);
    expect(isHistoryRowAfterCursor(row("2026-08-09", s1), cursor)).toBe(false);
    expect(isHistoryRowAfterCursor(row("2026-08-10", s1), cursor)).toBe(false);
  });

  test("mergeAttendanceHistoryPage sorts newest-first and returns next cursor", () => {
    const { items, nextCursor } = mergeAttendanceHistoryPage(
      [row("2026-08-07", s1), row("2026-08-09", s2), row("2026-08-09", s1), row("2026-08-08", s1)],
      2,
      null,
    );

    expect(items).toEqual([row("2026-08-09", s1), row("2026-08-09", s2)]);
    expect(nextCursor).toEqual({ dateKey: "2026-08-09", studentUserId: s2 });
  });

  test("mergeAttendanceHistoryPage applies cursor and multi-student pages", () => {
    const { items, nextCursor } = mergeAttendanceHistoryPage(
      [
        row("2026-08-09", s1),
        row("2026-08-09", s2),
        row("2026-08-08", s1),
        row("2026-08-08", s2),
        row("2026-08-07", s1),
      ],
      2,
      { dateKey: "2026-08-09", studentUserId: s2 },
    );

    expect(items).toEqual([row("2026-08-08", s1), row("2026-08-08", s2)]);
    expect(nextCursor).toEqual({ dateKey: "2026-08-08", studentUserId: s2 });
  });

  test("mergeAttendanceHistoryPage omits next cursor on short final page", () => {
    const { items, nextCursor } = mergeAttendanceHistoryPage([row("2026-08-01", s1)], 40, null);
    expect(items).toHaveLength(1);
    expect(nextCursor).toBeNull();
  });
});
