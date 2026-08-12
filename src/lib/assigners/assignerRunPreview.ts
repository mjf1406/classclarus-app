import { memberMatchesQuery, normalizeSearchText } from "@/lib/members/memberSearch";
import type { StudentRosterEntry } from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

export type AssignerPreviewAssignment = {
  studentUserId: Id<"users">;
  studentDisplayName: string;
  item: string;
  rosterNumber?: number;
  firstName?: string;
  lastName?: string;
  groupName?: string;
};

export type AssignerPreviewRosterRow = StudentRosterEntry & {
  assignmentIndex: number;
  assignedItem: string;
  assignedGroupName?: string;
};

export type AssignerPreviewNameFilters = {
  firstName: string;
  lastName: string;
  name: string;
};

export function isAssignerPreviewRosterRow(
  row: StudentRosterEntry,
): row is AssignerPreviewRosterRow {
  return (
    "assignmentIndex" in row &&
    typeof (row as AssignerPreviewRosterRow).assignmentIndex === "number" &&
    "assignedItem" in row &&
    typeof (row as AssignerPreviewRosterRow).assignedItem === "string"
  );
}

export function buildAssignerPreviewRows(
  assignments: readonly AssignerPreviewAssignment[],
  roster: readonly StudentRosterEntry[] | undefined,
): AssignerPreviewRosterRow[] {
  const byId = new Map((roster ?? []).map((student) => [student.userId, student]));
  return assignments.map((assignment, assignmentIndex) => {
    const live = byId.get(assignment.studentUserId);
    const snapshot: StudentRosterEntry = {
      userId: assignment.studentUserId,
      rosterNumber: assignment.rosterNumber ?? 0,
      firstName: assignment.firstName,
      lastName: assignment.lastName,
      name: assignment.studentDisplayName,
      role: "student",
    };
    const base = live ?? snapshot;
    return {
      ...base,
      firstName: base.firstName ?? assignment.firstName,
      lastName: base.lastName ?? assignment.lastName,
      name: base.name ?? assignment.studentDisplayName,
      rosterNumber: base.rosterNumber || assignment.rosterNumber || 0,
      assignmentIndex,
      assignedItem: assignment.item,
      assignedGroupName: assignment.groupName,
    };
  });
}

export function assignerPreviewRowMatchesNameFilters(
  row: StudentRosterEntry,
  filters: AssignerPreviewNameFilters,
): boolean {
  const firstQuery = normalizeSearchText(filters.firstName);
  if (firstQuery && !normalizeSearchText(row.firstName ?? "").includes(firstQuery)) {
    return false;
  }

  const lastQuery = normalizeSearchText(filters.lastName);
  if (lastQuery && !normalizeSearchText(row.lastName ?? "").includes(lastQuery)) {
    return false;
  }

  const nameQuery = normalizeSearchText(filters.name);
  if (
    nameQuery &&
    !memberMatchesQuery(
      {
        id: row.userId,
        name: row.name,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
      },
      nameQuery,
    )
  ) {
    return false;
  }

  return true;
}

export function filterAssignerPreviewRows(
  rows: readonly AssignerPreviewRosterRow[],
  filters: AssignerPreviewNameFilters,
): AssignerPreviewRosterRow[] {
  if (!filters.firstName.trim() && !filters.lastName.trim() && !filters.name.trim()) {
    return [...rows];
  }
  return rows.filter((row) => assignerPreviewRowMatchesNameFilters(row, filters));
}
