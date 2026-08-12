import type { Doc, Id } from "../../_generated/dataModel.js";

/** Pure seat/layout helpers safe for client + server (no Convex ctx). */

export type SeatLayoutItemSnapshot = Doc<"seatLayouts">["items"][number];

export type ChartAssignmentInput = {
  deskItemId: string;
  groupId?: Id<"groups">;
  studentUserId: Id<"users">;
};

export type ChartAssignment = {
  deskItemId: string;
  groupId: Id<"groups">;
  studentUserId: Id<"users">;
};

export function deskItemsById(
  items: Array<SeatLayoutItemSnapshot>,
): Map<string, SeatLayoutItemSnapshot> {
  return new Map(items.filter((item) => item.kind === "desk").map((item) => [item.id, item]));
}

export function slotKey(deskItemId: string, groupId: Id<"groups">): string {
  return `${deskItemId}:${groupId}`;
}

/** Cardinal adjacency: shared edge within 1px; corners do not count. */
export function findStrictDeskNeighborIds(
  items: Array<SeatLayoutItemSnapshot>,
): Map<string, Array<string>> {
  const gapTolerance = 1;
  const minOverlapPx = 1;
  const desks = items.filter((item) => item.kind === "desk");
  const neighbors = new Map<string, Array<string>>();

  const addNeighbor = (fromId: string, toId: string) => {
    const existing = neighbors.get(fromId) ?? [];
    if (!existing.includes(toId)) {
      existing.push(toId);
      neighbors.set(fromId, existing);
    }
  };

  for (let i = 0; i < desks.length; i += 1) {
    const a = desks[i];
    if (!a) continue;
    for (let j = i + 1; j < desks.length; j += 1) {
      const b = desks[j];
      if (!b) continue;

      const aRight = a.x + a.width;
      const aBottom = a.y + a.height;
      const bRight = b.x + b.width;
      const bBottom = b.y + b.height;
      const overlapX = Math.min(aRight, bRight) - Math.max(a.x, b.x);
      const overlapY = Math.min(aBottom, bBottom) - Math.max(a.y, b.y);

      const gapEast = b.x - aRight;
      if (gapEast >= -1 && gapEast <= gapTolerance && overlapY >= minOverlapPx) {
        addNeighbor(a.id, b.id);
        addNeighbor(b.id, a.id);
        continue;
      }
      const gapWest = a.x - bRight;
      if (gapWest >= -1 && gapWest <= gapTolerance && overlapY >= minOverlapPx) {
        addNeighbor(a.id, b.id);
        addNeighbor(b.id, a.id);
        continue;
      }
      const gapSouth = b.y - aBottom;
      if (gapSouth >= -1 && gapSouth <= gapTolerance && overlapX >= minOverlapPx) {
        addNeighbor(a.id, b.id);
        addNeighbor(b.id, a.id);
        continue;
      }
      const gapNorth = a.y - bBottom;
      if (gapNorth >= -1 && gapNorth <= gapTolerance && overlapX >= minOverlapPx) {
        addNeighbor(a.id, b.id);
        addNeighbor(b.id, a.id);
      }
    }
  }

  return neighbors;
}
