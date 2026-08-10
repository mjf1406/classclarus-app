import { describe, expect, test } from "vite-plus/test";

import { findDeskNeighbors, snapRect, snapRectToGrid, snapToGridValue } from "./seatSnap";

describe("snapRect", () => {
  test("snaps left edge to another item's right edge", () => {
    const result = snapRect(
      { id: "b", x: 108, y: 10, width: 80, height: 60 },
      [{ id: "a", x: 0, y: 0, width: 100, height: 60 }],
      { canvasWidth: 400, canvasHeight: 400, threshold: 8 },
    );
    expect(result.x).toBe(100);
    expect(result.guides.some((g) => g.orientation === "vertical" && g.position === 100)).toBe(
      true,
    );
  });

  test("shift/disabled bypasses snap", () => {
    const result = snapRect(
      { id: "b", x: 108, y: 10, width: 80, height: 60 },
      [{ id: "a", x: 0, y: 0, width: 100, height: 60 }],
      { canvasWidth: 400, canvasHeight: 400, enabled: false },
    );
    expect(result.x).toBe(108);
    expect(result.guides).toEqual([]);
  });
});

describe("snapRectToGrid", () => {
  test("rounds position to grid", () => {
    expect(snapToGridValue(14, 20)).toBe(20);
    expect(snapToGridValue(9, 20)).toBe(0);
    const result = snapRectToGrid(
      { id: "a", x: 14, y: 27, width: 80, height: 60 },
      { gridSize: 20 },
    );
    expect(result).toEqual({ x: 20, y: 20, width: 80, height: 60, guides: [] });
  });

  test("snaps resize edges to grid", () => {
    const east = snapRectToGrid(
      { id: "a", x: 20, y: 20, width: 54, height: 60 },
      { gridSize: 20, resizeEdge: "e" },
    );
    expect(east.width).toBe(60);

    const west = snapRectToGrid(
      { id: "a", x: 27, y: 20, width: 80, height: 60 },
      { gridSize: 20, resizeEdge: "w" },
    );
    expect(west.x).toBe(20);
    expect(west.width).toBe(87);
  });

  test("disabled bypasses grid snap", () => {
    const result = snapRectToGrid(
      { id: "a", x: 14, y: 27, width: 80, height: 60 },
      { gridSize: 20, enabled: false },
    );
    expect(result.x).toBe(14);
    expect(result.y).toBe(27);
  });
});

describe("findDeskNeighbors", () => {
  test("detects east/west neighbors for abutting desks", () => {
    const edges = findDeskNeighbors([
      { id: "1", kind: "desk", x: 0, y: 0, width: 80, height: 60 },
      { id: "2", kind: "desk", x: 80, y: 0, width: 80, height: 60 },
      { id: "board", kind: "board", x: 0, y: 100, width: 200, height: 40 },
    ]);
    expect(edges).toEqual(
      expect.arrayContaining([
        { fromDeskId: "1", toDeskId: "2", direction: "east" },
        { fromDeskId: "2", toDeskId: "1", direction: "west" },
      ]),
    );
    expect(edges.every((e) => e.fromDeskId !== "board" && e.toDeskId !== "board")).toBe(true);
  });

  test("detects north/south neighbors within gap tolerance", () => {
    const edges = findDeskNeighbors([
      { id: "1", kind: "desk", x: 0, y: 0, width: 80, height: 60 },
      { id: "2", kind: "desk", x: 0, y: 68, width: 80, height: 60 },
    ]);
    expect(edges).toEqual(
      expect.arrayContaining([
        { fromDeskId: "1", toDeskId: "2", direction: "south" },
        { fromDeskId: "2", toDeskId: "1", direction: "north" },
      ]),
    );
  });
});
