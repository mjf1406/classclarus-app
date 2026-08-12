import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel.js";

/** Full assignment row stored on assigner runs. */
export type StoredAssignerRunAssignment = {
  studentUserId: Id<"users">;
  studentDisplayName: string;
  item: string;
  rosterNumber?: number;
  firstName?: string;
  lastName?: string;
  groupId?: Id<"groups">;
  groupName?: string;
};

export type StaffAssignerRunAssignment = StoredAssignerRunAssignment;

/** Allowlisted payload for callers without `students:read`. */
export type ConsumerAssignerRunAssignment = {
  studentUserId: Id<"users">;
  rosterNumber?: number;
  firstName?: string;
  lastName?: string;
  item: string;
  groupName?: string;
};

export const staffAssignerRunAssignmentValidator = v.object({
  studentUserId: v.id("users"),
  studentDisplayName: v.string(),
  item: v.string(),
  rosterNumber: v.optional(v.number()),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  groupId: v.optional(v.id("groups")),
  groupName: v.optional(v.string()),
});

export const consumerAssignerRunAssignmentValidator = v.object({
  studentUserId: v.id("users"),
  rosterNumber: v.optional(v.number()),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  item: v.string(),
  groupName: v.optional(v.string()),
});

export const assignerRunAssignmentValidator = v.union(
  staffAssignerRunAssignmentValidator,
  consumerAssignerRunAssignmentValidator,
);

export function isStaffAssignerRunAssignment(
  assignment: StaffAssignerRunAssignment | ConsumerAssignerRunAssignment,
): assignment is StaffAssignerRunAssignment {
  return "studentDisplayName" in assignment;
}

export function projectAssignerRunAssignments(
  assignments: readonly StoredAssignerRunAssignment[],
  canReadFullRoster: boolean,
): StaffAssignerRunAssignment[] | ConsumerAssignerRunAssignment[] {
  if (canReadFullRoster) {
    return assignments.map((assignment) => ({ ...assignment }));
  }
  return assignments.map((assignment) => ({
    studentUserId: assignment.studentUserId,
    rosterNumber: assignment.rosterNumber,
    firstName: assignment.firstName,
    lastName: assignment.lastName,
    item: assignment.item,
    groupName: assignment.groupName,
  }));
}
