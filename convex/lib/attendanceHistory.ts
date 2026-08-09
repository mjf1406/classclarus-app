import type { Id } from "../_generated/dataModel.js";

export type AttendanceHistoryRow = {
  dateKey: string;
  studentUserId: Id<"users">;
  status: "present" | "absent" | "late";
};

export type AttendanceHistoryCursor = {
  dateKey: string;
  studentUserId: Id<"users">;
};

/** True when `row` is strictly older than `cursor` in newest-first compound order. */
export function isHistoryRowAfterCursor(
  row: { dateKey: string; studentUserId: Id<"users"> },
  cursor: AttendanceHistoryCursor,
): boolean {
  if (row.dateKey !== cursor.dateKey) return row.dateKey < cursor.dateKey;
  return row.studentUserId > cursor.studentUserId;
}

/**
 * Merge per-student candidate rows into a newest-first page, preserving the
 * compound (dateKey, studentUserId) cursor semantics.
 */
export function mergeAttendanceHistoryPage(
  candidates: AttendanceHistoryRow[],
  limit: number,
  cursor: AttendanceHistoryCursor | null,
): {
  items: AttendanceHistoryRow[];
  nextCursor: AttendanceHistoryCursor | null;
} {
  const filtered = cursor
    ? candidates.filter((row) => isHistoryRowAfterCursor(row, cursor))
    : candidates;

  filtered.sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey < b.dateKey ? 1 : -1;
    if (a.studentUserId === b.studentUserId) return 0;
    return a.studentUserId < b.studentUserId ? -1 : 1;
  });

  const items = filtered.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor:
      items.length === limit && last
        ? { dateKey: last.dateKey, studentUserId: last.studentUserId }
        : null,
  };
}
