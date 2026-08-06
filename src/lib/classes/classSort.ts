export type ClassSortKey = "name" | "created" | "updated";
export type ClassSortDirection = "asc" | "desc";
export type ClassViewMode = "grid" | "list";

export type SortableClass = {
  _id: string;
  _creationTime: number;
  name: string;
  year: number;
  updatedAt: number;
  archivedAt?: number;
};

export function compareClasses<T extends SortableClass>(
  a: T,
  b: T,
  sortKey: ClassSortKey,
  direction: ClassSortDirection,
): number {
  const dir = direction === "asc" ? 1 : -1;
  switch (sortKey) {
    case "name": {
      const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      if (byName !== 0) return byName * dir;
      return (a.year - b.year) * dir;
    }
    case "created":
      return (a._creationTime - b._creationTime) * dir;
    case "updated":
      return (a.updatedAt - b.updatedAt) * dir;
  }
}

export function sortClasses<T extends SortableClass>(
  classes: readonly T[],
  sortKey: ClassSortKey,
  direction: ClassSortDirection,
): T[] {
  return [...classes].sort((a, b) => compareClasses(a, b, sortKey, direction));
}

export function partitionClassesByArchive<T extends SortableClass>(
  classes: readonly T[],
): { active: T[]; archived: T[] } {
  const active: T[] = [];
  const archived: T[] = [];
  for (const classDoc of classes) {
    if (classDoc.archivedAt !== undefined) {
      archived.push(classDoc);
    } else {
      active.push(classDoc);
    }
  }
  return { active, archived };
}

export function nextSortState(
  currentKey: ClassSortKey,
  currentDirection: ClassSortDirection,
  nextKey: ClassSortKey,
): { sortKey: ClassSortKey; sortDirection: ClassSortDirection } {
  if (currentKey === nextKey) {
    return {
      sortKey: currentKey,
      sortDirection: currentDirection === "asc" ? "desc" : "asc",
    };
  }
  // Default: name ascending, created/updated descending (newest first)
  return {
    sortKey: nextKey,
    sortDirection: nextKey === "name" ? "asc" : "desc",
  };
}
