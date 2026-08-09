import type { FunctionReturnType } from "convex/server";

import { api } from "../../../convex/_generated/api";

export type PointsBoardStudent = FunctionReturnType<typeof api.points.board>[number];
export type PointsBoard = FunctionReturnType<typeof api.points.board>;

export type PointsSortKey = "firstName" | "lastName" | "rosterNumber" | "points";
export type PointsSortDirection = "asc" | "desc";

export type PointsApplyTab = "award" | "remove" | "redeem";

/** Max length for optional notes when removing points (matches Convex). */
export const MAX_APPLICATION_NOTE_LENGTH = 500;

export type PointsCatalogView = "list" | "grid";

export function isPointsCatalogView(value: string): value is PointsCatalogView {
  return value === "list" || value === "grid";
}

export type PointsCatalogFolder = {
  _id: string;
  name: string;
  icon?: string;
};

/** Partition catalog items by folder id (`null` = unfiled). */
export function partitionPointsCatalogByFolder<T extends { folderId?: string }>(
  items: readonly T[],
  folderId: string | null,
): T[] {
  if (folderId === null) {
    return items.filter((item) => item.folderId === undefined);
  }
  return items.filter((item) => item.folderId === folderId);
}

export function nextPointsSortState(
  currentKey: PointsSortKey,
  currentDirection: PointsSortDirection,
  nextKey: PointsSortKey,
): { sortKey: PointsSortKey; sortDirection: PointsSortDirection } {
  if (currentKey === nextKey) {
    return {
      sortKey: currentKey,
      sortDirection: currentDirection === "asc" ? "desc" : "asc",
    };
  }
  return {
    sortKey: nextKey,
    // Names / roster #: A→Z / low→high (asc). Points: high→low (desc).
    sortDirection: nextKey === "points" ? "desc" : "asc",
  };
}

function namePart(value: string | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

export function comparePointsStudents(
  a: PointsBoardStudent,
  b: PointsBoardStudent,
  sortKey: PointsSortKey,
  direction: PointsSortDirection,
): number {
  const dir = direction === "asc" ? 1 : -1;
  switch (sortKey) {
    case "firstName": {
      const byFirst = namePart(a.firstName).localeCompare(namePart(b.firstName));
      if (byFirst !== 0) return byFirst * dir;
      const byLast = namePart(a.lastName).localeCompare(namePart(b.lastName));
      if (byLast !== 0) return byLast * dir;
      return (a.rosterNumber - b.rosterNumber) * dir;
    }
    case "lastName": {
      const byLast = namePart(a.lastName).localeCompare(namePart(b.lastName));
      if (byLast !== 0) return byLast * dir;
      const byFirst = namePart(a.firstName).localeCompare(namePart(b.firstName));
      if (byFirst !== 0) return byFirst * dir;
      return (a.rosterNumber - b.rosterNumber) * dir;
    }
    case "rosterNumber":
      return (a.rosterNumber - b.rosterNumber) * dir;
    case "points": {
      const byPoints = a.pointsBalance - b.pointsBalance;
      if (byPoints !== 0) return byPoints * dir;
      return (a.rosterNumber - b.rosterNumber) * dir;
    }
  }
}

export function sortPointsStudents(
  students: readonly PointsBoardStudent[],
  sortKey: PointsSortKey,
  direction: PointsSortDirection,
): PointsBoardStudent[] {
  return [...students].sort((a, b) => comparePointsStudents(a, b, sortKey, direction));
}

export function isAbsentStudent(student: PointsBoardStudent): boolean {
  return student.attendanceStatus === "absent";
}
