import type { FunctionReturnType } from "convex/server";

import type { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { SeatLayoutItem } from "@/lib/assigners/seatLayouts";
import { findStrictDeskNeighbors } from "@/lib/assigners/seatSnap";

export type SeatChartList = FunctionReturnType<typeof api.seatCharts.list>;
export type SeatChartListItem = SeatChartList[number];
export type SeatChart = FunctionReturnType<typeof api.seatCharts.get>;
export type SeatChartAssignment = SeatChart["assignments"][number] & {
  groupId: Id<"groups">;
};
export type SeatChartRecord = FunctionReturnType<typeof api.seatCharts.getRecord>;
export type SeatChartStudentSummary = FunctionReturnType<typeof api.seatCharts.studentSummary>;
export type SeatChartHistoryItem = FunctionReturnType<
  typeof api.seatCharts.studentHistory
>["items"][number];
export type SeatChartViolation = FunctionReturnType<
  typeof api.seatCharts.previewViolations
>[number];

export type SeatChartSortKey = "name" | "updated" | "records";
export type SeatChartSortDirection = "asc" | "desc";

export type SeatChartCohortFilter = "class" | "group" | "team";

export function slotKey(deskItemId: string, groupId: Id<"groups">): string {
  return `${deskItemId}:${groupId}`;
}

export function assignmentBySlotMap(
  assignments: ReadonlyArray<SeatChartAssignment>,
): Map<string, SeatChartAssignment> {
  return new Map(
    assignments.map((assignment) => [
      slotKey(assignment.deskItemId, assignment.groupId),
      assignment,
    ]),
  );
}

export function assignmentsForDesk(
  assignments: ReadonlyArray<SeatChartAssignment>,
  deskItemId: string,
): Array<SeatChartAssignment> {
  return assignments.filter((assignment) => assignment.deskItemId === deskItemId);
}

export function studentAssignmentMap(
  assignments: ReadonlyArray<SeatChartAssignment>,
): Map<Id<"users">, SeatChartAssignment> {
  return new Map(assignments.map((assignment) => [assignment.studentUserId, assignment]));
}

export function hydrateAssignmentsFromBoard(
  assignments: ReadonlyArray<{
    deskItemId: string;
    groupId?: Id<"groups">;
    studentUserId: Id<"users">;
  }>,
  groupIdByStudent: Readonly<Record<string, Id<"groups"> | undefined>>,
): Array<SeatChartAssignment> {
  const result: Array<SeatChartAssignment> = [];
  for (const assignment of assignments) {
    const groupId = assignment.groupId ?? groupIdByStudent[assignment.studentUserId];
    if (!groupId) continue;
    result.push({
      deskItemId: assignment.deskItemId,
      groupId,
      studentUserId: assignment.studentUserId,
    });
  }
  return result;
}

export function assignStudentToSlot(
  assignments: Array<SeatChartAssignment>,
  deskItemId: string,
  groupId: Id<"groups">,
  studentUserId: Id<"users">,
): Array<SeatChartAssignment> {
  const withoutStudent = assignments.filter((a) => a.studentUserId !== studentUserId);
  const withoutSlot = withoutStudent.filter(
    (a) => !(a.deskItemId === deskItemId && a.groupId === groupId),
  );
  return [...withoutSlot, { deskItemId, groupId, studentUserId }];
}

export function assignStudentToDesk(
  assignments: Array<SeatChartAssignment>,
  deskItemId: string,
  groupId: Id<"groups">,
  studentUserId: Id<"users">,
): Array<SeatChartAssignment> {
  return assignStudentToSlot(assignments, deskItemId, groupId, studentUserId);
}

export function unassignDeskSlot(
  assignments: Array<SeatChartAssignment>,
  deskItemId: string,
  groupId: Id<"groups">,
): Array<SeatChartAssignment> {
  return assignments.filter(
    (assignment) => !(assignment.deskItemId === deskItemId && assignment.groupId === groupId),
  );
}

export function unassignDesk(
  assignments: Array<SeatChartAssignment>,
  deskItemId: string,
): Array<SeatChartAssignment> {
  return assignments.filter((assignment) => assignment.deskItemId !== deskItemId);
}

export function unassignStudent(
  assignments: Array<SeatChartAssignment>,
  studentUserId: Id<"users">,
): Array<SeatChartAssignment> {
  return assignments.filter((assignment) => assignment.studentUserId !== studentUserId);
}

export function swapDeskAssignments(
  assignments: Array<SeatChartAssignment>,
  deskA: string,
  deskB: string,
): Array<SeatChartAssignment> {
  const onA = assignments.filter((assignment) => assignment.deskItemId === deskA);
  const onB = assignments.filter((assignment) => assignment.deskItemId === deskB);
  const rest = assignments.filter(
    (assignment) => assignment.deskItemId !== deskA && assignment.deskItemId !== deskB,
  );
  return [
    ...rest,
    ...onA.map((assignment) => ({ ...assignment, deskItemId: deskB })),
    ...onB.map((assignment) => ({ ...assignment, deskItemId: deskA })),
  ];
}

export function neighborDeskIdsForDesk(
  items: ReadonlyArray<SeatLayoutItem>,
  deskItemId: string,
): Array<string> {
  const edges = findStrictDeskNeighbors(items);
  const neighbors = new Set<string>();
  for (const edge of edges) {
    if (edge.fromDeskId === deskItemId) neighbors.add(edge.toDeskId);
    if (edge.toDeskId === deskItemId) neighbors.add(edge.fromDeskId);
  }
  return [...neighbors];
}

export function compareSeatCharts(
  a: SeatChartListItem,
  b: SeatChartListItem,
  sortKey: SeatChartSortKey,
  direction: SeatChartSortDirection,
): number {
  const dir = direction === "asc" ? 1 : -1;
  switch (sortKey) {
    case "name":
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) * dir;
    case "records":
      return (a.recordCount - b.recordCount) * dir;
    case "updated":
      return (a.updatedAt - b.updatedAt) * dir;
  }
}

export function sortSeatCharts(
  charts: readonly SeatChartListItem[],
  sortKey: SeatChartSortKey,
  direction: SeatChartSortDirection,
): SeatChartListItem[] {
  return [...charts].sort((a, b) => compareSeatCharts(a, b, sortKey, direction));
}

export function assignmentsEqual(
  a: ReadonlyArray<SeatChartAssignment>,
  b: ReadonlyArray<SeatChartAssignment>,
): boolean {
  if (a.length !== b.length) return false;
  const mapB = assignmentBySlotMap(b);
  for (const assignment of a) {
    const other = mapB.get(slotKey(assignment.deskItemId, assignment.groupId));
    if (!other || other.studentUserId !== assignment.studentUserId) return false;
  }
  return true;
}

export function violationsForStudent(
  violations: ReadonlyArray<SeatChartViolation>,
  studentUserId: Id<"users">,
): Array<SeatChartViolation> {
  return violations.filter((violation) => violation.studentUserIds.includes(studentUserId));
}
