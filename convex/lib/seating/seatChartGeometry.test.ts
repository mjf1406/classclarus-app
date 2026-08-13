import { describe, expect, it } from "vite-plus/test";

import {
  deskItem,
  DESK_SIZE,
  expectedNeighborsFromCells,
  grid4x5,
  grid5x6,
  teacherDeskItem,
  uShape24,
} from "./classroomLayouts.js";
import { findStrictDeskNeighborIds } from "./seatChartGeometry.js";
import { neighborMapFromIds } from "./seatingTestHelpers.js";

function sortedNeighborMap(items: Parameters<typeof findStrictDeskNeighborIds>[0]) {
  return neighborMapFromIds(findStrictDeskNeighborIds(items));
}

describe("findStrictDeskNeighborIds", () => {
  it("matches independent 4-connectivity on a 4x5 touching grid", () => {
    const layout = grid4x5();
    expect(sortedNeighborMap(layout.items)).toEqual(layout.expectedNeighbors);
  });

  it("matches independent 4-connectivity on a 5x6 touching grid", () => {
    const layout = grid5x6();
    expect(sortedNeighborMap(layout.items)).toEqual(layout.expectedNeighbors);
  });

  it("matches independent 4-connectivity on a U-shaped room", () => {
    const layout = uShape24();
    expect(sortedNeighborMap(layout.items)).toEqual(layout.expectedNeighbors);
  });

  it("treats a 1px gap as adjacent when the shared edge overlaps", () => {
    const items = [
      deskItem({ id: "a", x: 0, y: 0 }),
      deskItem({ id: "b", x: DESK_SIZE + 1, y: 0 }),
    ];
    expect(sortedNeighborMap(items).get("a")).toEqual(["b"]);
    expect(sortedNeighborMap(items).get("b")).toEqual(["a"]);
  });

  it("does not treat corner-only contact as adjacency", () => {
    const items = [
      deskItem({ id: "a", x: 0, y: 0 }),
      deskItem({ id: "b", x: DESK_SIZE, y: DESK_SIZE }),
    ];
    expect(sortedNeighborMap(items).get("a") ?? []).toEqual([]);
    expect(sortedNeighborMap(items).get("b") ?? []).toEqual([]);
  });

  it("ignores non-desk items", () => {
    const items = [
      deskItem({ id: "a", x: 0, y: 0 }),
      deskItem({ id: "b", x: DESK_SIZE, y: 0 }),
      teacherDeskItem(),
    ];
    const neighbors = sortedNeighborMap(items);
    expect(neighbors.has("teacher-desk")).toBe(false);
    expect(neighbors.get("a")).toEqual(["b"]);
  });

  it("is symmetric", () => {
    const layout = grid4x5();
    const neighbors = sortedNeighborMap(layout.items);
    for (const [from, tos] of neighbors) {
      for (const to of tos) {
        expect(neighbors.get(to) ?? []).toContain(from);
      }
    }
  });

  it("agrees with occupancy-cell oracle when a desk is offset by 1px diagonally", () => {
    const cells = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ];
    const items = [
      deskItem({ id: "desk-1", x: 0, y: 0 }),
      deskItem({ id: "desk-2", x: DESK_SIZE + 1, y: 1 }),
    ];
    expect(sortedNeighborMap(items).get("desk-1")).toEqual(["desk-2"]);
    expect(expectedNeighborsFromCells(cells, 2).get("desk-1")).toEqual(["desk-2"]);
  });
});
