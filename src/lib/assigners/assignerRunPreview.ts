import { memberMatchesQuery, normalizeSearchText } from "@/lib/members/memberSearch";
import type { RosterColumnId, StudentRosterEntry } from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

export type StaffAssignerPreviewAssignment = {
  studentUserId: Id<"users">;
  studentDisplayName: string;
  item: string;
  rosterNumber?: number;
  firstName?: string;
  lastName?: string;
  groupId?: Id<"groups">;
  groupName?: string;
};

/** Server allowlist for callers without `students:read`. */
export type ConsumerAssignerPreviewAssignment = {
  studentUserId: Id<"users">;
  rosterNumber?: number;
  firstName?: string;
  lastName?: string;
  item: string;
  groupName?: string;
};

export type AssignerPreviewAssignment =
  | StaffAssignerPreviewAssignment
  | ConsumerAssignerPreviewAssignment;

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

export const RESTRICTED_ROSTER_COLUMN_ORDER = ["rosterNumber", "lastName", "firstName"] as const;

export type RestrictedRosterColumnId = (typeof RESTRICTED_ROSTER_COLUMN_ORDER)[number];

export const RESTRICTED_ROSTER_COLUMN_VISIBILITY: Record<RosterColumnId, boolean> = {
  rosterNumber: true,
  lastName: true,
  firstName: true,
  name: false,
  email: false,
  gender: false,
  pronouns: false,
};

export function isStaffAssignerPreviewAssignment(
  assignment: AssignerPreviewAssignment,
): assignment is StaffAssignerPreviewAssignment {
  return "studentDisplayName" in assignment;
}

export function isConsumerAssignerPreviewAssignment(
  assignment: AssignerPreviewAssignment,
): assignment is ConsumerAssignerPreviewAssignment {
  return !("studentDisplayName" in assignment);
}

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

/** Allowlisted fields only — never copies email/name/gender/pronouns/image/groupId. */
export function buildConsumerAssignerPreviewRows(
  assignments: readonly AssignerPreviewAssignment[],
): AssignerPreviewRosterRow[] {
  return assignments.map((assignment, assignmentIndex) => ({
    userId: assignment.studentUserId,
    rosterNumber: assignment.rosterNumber ?? 0,
    firstName: assignment.firstName,
    lastName: assignment.lastName,
    role: "student" as const,
    assignmentIndex,
    assignedItem: assignment.item,
    assignedGroupName: assignment.groupName,
  }));
}

function assignmentDisplayName(assignment: AssignerPreviewAssignment): string | undefined {
  if (isStaffAssignerPreviewAssignment(assignment)) {
    return assignment.studentDisplayName;
  }
  return undefined;
}

export function buildAssignerPreviewRows(
  assignments: readonly AssignerPreviewAssignment[],
  roster: readonly StudentRosterEntry[] | undefined,
): AssignerPreviewRosterRow[] {
  const byId = new Map((roster ?? []).map((student) => [student.userId, student]));
  return assignments.map((assignment, assignmentIndex) => {
    const live = byId.get(assignment.studentUserId);
    const displayName = assignmentDisplayName(assignment);
    const snapshot: StudentRosterEntry = {
      userId: assignment.studentUserId,
      rosterNumber: assignment.rosterNumber ?? 0,
      firstName: assignment.firstName,
      lastName: assignment.lastName,
      name: displayName,
      role: "student",
    };
    const base = live ?? snapshot;
    return {
      ...base,
      firstName: base.firstName ?? assignment.firstName,
      lastName: base.lastName ?? assignment.lastName,
      name: base.name ?? displayName,
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

export function filterConsumerAssignerPreviewRows(
  rows: readonly AssignerPreviewRosterRow[],
  filters: Pick<AssignerPreviewNameFilters, "firstName" | "lastName">,
): AssignerPreviewRosterRow[] {
  if (!filters.firstName.trim() && !filters.lastName.trim()) {
    return [...rows];
  }
  return rows.filter((row) =>
    assignerPreviewRowMatchesNameFilters(row, {
      ...filters,
      name: "",
    }),
  );
}
