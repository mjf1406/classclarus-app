import type { Id } from "../../_generated/dataModel.js";

export type EquitablePriorAssignmentRow = {
  studentUserId: string;
  item: string;
};

export type EquitableRosterMatrixStudentCounts = {
  studentUserId: Id<"users">;
  counts: Array<{ item: string; count: number }>;
};

/** Aggregate per-student counts for the assigner's current item list. */
export function buildEquitableRosterMatrixCounts(
  items: string[],
  studentUserIds: Id<"users">[],
  priorAssignments: EquitablePriorAssignmentRow[],
): EquitableRosterMatrixStudentCounts[] {
  const itemSet = new Set(items);
  const countsByStudent = new Map<string, Map<string, number>>();

  for (const studentUserId of studentUserIds) {
    countsByStudent.set(studentUserId, new Map(items.map((item) => [item, 0] as const)));
  }

  for (const row of priorAssignments) {
    if (!itemSet.has(row.item)) continue;
    const studentCounts = countsByStudent.get(row.studentUserId);
    if (!studentCounts) continue;
    studentCounts.set(row.item, (studentCounts.get(row.item) ?? 0) + 1);
  }

  return studentUserIds.map((studentUserId) => ({
    studentUserId,
    counts: items.map((item) => ({
      item,
      count: countsByStudent.get(studentUserId)?.get(item) ?? 0,
    })),
  }));
}
