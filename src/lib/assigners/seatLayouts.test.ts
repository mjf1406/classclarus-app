import { describe, expect, test } from "vite-plus/test";

import {
  buildDeskGrid,
  canvasResizePanDelta,
  clampDeskGridDims,
  CANVAS_RESIZE_STEP,
  commonTeamAssignment,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_DESK_HEIGHT,
  DEFAULT_DESK_WIDTH,
  deskGridBlockSize,
  MAX_CANVAS_SIZE,
  MAX_DESKS_PER_ADD,
  MIN_CANVAS_SIZE,
  nextPlacementOrigin,
  resizeSeatCanvas,
  SEAT_CANVAS_GRID_SIZE,
  topLeftPlacementOrigin,
  seatItemDisplayLabel,
  teamAssignmentsEqual,
  type SeatLayoutItem,
} from "@/lib/assigners/seatLayouts";
import type { Id } from "../../../convex/_generated/dataModel";

function rectItem(id: string, x: number, y: number, width = 80, height = 60): SeatLayoutItem {
  return { id, kind: "rect", label: "", x, y, width, height };
}

const defaults = {
  teacherDesk: "教卓",
  board: "黒板",
  rect: "ラベル",
};

describe("seatItemDisplayLabel", () => {
  test("uses kind default when label is empty", () => {
    expect(seatItemDisplayLabel({ kind: "teacherDesk", label: "" }, defaults)).toBe("教卓");
    expect(seatItemDisplayLabel({ kind: "board", label: "  " }, defaults)).toBe("黒板");
    expect(seatItemDisplayLabel({ kind: "rect", label: "" }, defaults)).toBe("ラベル");
    expect(seatItemDisplayLabel({ kind: "desk", label: "" }, defaults)).toBe("");
  });

  test("localizes legacy English defaults", () => {
    expect(seatItemDisplayLabel({ kind: "teacherDesk", label: "Teacher's desk" }, defaults)).toBe(
      "教卓",
    );
    expect(seatItemDisplayLabel({ kind: "teacherDesk", label: "Teacher’s desk" }, defaults)).toBe(
      "教卓",
    );
    expect(seatItemDisplayLabel({ kind: "board", label: "Board" }, defaults)).toBe("黒板");
    expect(seatItemDisplayLabel({ kind: "rect", label: "Label" }, defaults)).toBe("ラベル");
    expect(seatItemDisplayLabel({ kind: "rect", label: "Custom" }, defaults)).toBe("ラベル");
  });

  test("keeps custom labels", () => {
    expect(seatItemDisplayLabel({ kind: "board", label: "Whiteboard" }, defaults)).toBe(
      "Whiteboard",
    );
  });
});

describe("commonTeamAssignment", () => {
  const groupId = "g1" as Id<"groups">;
  const teamId = "t1" as Id<"teams">;

  test("returns shared assignment", () => {
    const assignment = { mode: "single" as const, groupId, teamId };
    expect(
      commonTeamAssignment([{ teamAssignment: assignment }, { teamAssignment: assignment }]),
    ).toEqual(assignment);
  });

  test("returns undefined when mixed or empty", () => {
    expect(commonTeamAssignment([])).toBeUndefined();
    expect(
      commonTeamAssignment([
        { teamAssignment: { mode: "single", groupId, teamId } },
        { teamAssignment: { mode: "byName", teamName: "A" } },
      ]),
    ).toBeUndefined();
  });

  test("compares byName case-insensitively", () => {
    expect(
      teamAssignmentsEqual(
        { mode: "byName", teamName: "Red" },
        { mode: "byName", teamName: "red" },
      ),
    ).toBe(true);
  });
});

describe("clampDeskGridDims", () => {
  test("clamps to min and max bounds", () => {
    expect(clampDeskGridDims(0, 0)).toEqual({ cols: 1, rows: 1 });
    expect(clampDeskGridDims(99, 99)).toEqual(clampDeskGridDims(12, 8));
  });

  test("reduces rows first so total stays within cap", () => {
    const dims = clampDeskGridDims(12, 8);
    expect(dims.cols * dims.rows).toBeLessThanOrEqual(MAX_DESKS_PER_ADD);
    expect(dims).toEqual({ cols: 12, rows: 3 });
  });
});

describe("topLeftPlacementOrigin", () => {
  test("returns the padded upper-left corner", () => {
    expect(topLeftPlacementOrigin()).toEqual({
      x: SEAT_CANVAS_GRID_SIZE * 2,
      y: SEAT_CANVAS_GRID_SIZE * 2,
    });
  });
});

describe("nextPlacementOrigin", () => {
  test("uses padded origin when empty", () => {
    expect(nextPlacementOrigin([])).toEqual(topLeftPlacementOrigin());
  });

  test("places below the lowest item on the grid", () => {
    expect(
      nextPlacementOrigin([
        { x: 40, y: 40, width: 80, height: 60 },
        { x: 40, y: 200, width: 80, height: 60 },
      ]),
    ).toEqual({
      x: SEAT_CANVAS_GRID_SIZE * 2,
      y: 280,
    });
  });
});

describe("resizeSeatCanvas", () => {
  test("defaults are 25 grid cells", () => {
    expect(DEFAULT_CANVAS_WIDTH).toBe(SEAT_CANVAS_GRID_SIZE * 25);
    expect(DEFAULT_CANVAS_HEIGHT).toBe(SEAT_CANVAS_GRID_SIZE * 25);
  });

  test("grows east and south without shifting items", () => {
    const items = [rectItem("a", 40, 40)];
    const east = resizeSeatCanvas({
      width: 500,
      height: 500,
      items,
      edge: "e",
      deltaCells: 1,
    });
    expect(east).toEqual({
      width: 520,
      height: 500,
      items,
    });
    const south = resizeSeatCanvas({
      width: 500,
      height: 500,
      items,
      edge: "s",
      deltaCells: 1,
    });
    expect(south).toEqual({
      width: 500,
      height: 520,
      items,
    });
  });

  test("grows west and north by shifting items", () => {
    const items = [rectItem("a", 40, 40)];
    const west = resizeSeatCanvas({
      width: 500,
      height: 500,
      items,
      edge: "w",
      deltaCells: 1,
    });
    expect(west?.width).toBe(520);
    expect(west?.items[0]).toMatchObject({ x: 60, y: 40 });
    const north = resizeSeatCanvas({
      width: 500,
      height: 500,
      items,
      edge: "n",
      deltaCells: 1,
    });
    expect(north?.height).toBe(520);
    expect(north?.items[0]).toMatchObject({ x: 40, y: 60 });
  });

  test("blocks shrink that would clip content", () => {
    const items = [rectItem("a", 0, 0, 500, 500)];
    expect(
      resizeSeatCanvas({
        width: 500,
        height: 500,
        items,
        edge: "e",
        deltaCells: -1,
      }),
    ).toBeNull();
    expect(
      resizeSeatCanvas({
        width: 500,
        height: 500,
        items,
        edge: "w",
        deltaCells: -1,
      }),
    ).toBeNull();
  });

  test("shrinks west when items have margin", () => {
    const items = [rectItem("a", 40, 40)];
    const result = resizeSeatCanvas({
      width: 500,
      height: 500,
      items,
      edge: "w",
      deltaCells: -1,
    });
    expect(result).toEqual({
      width: 480,
      height: 500,
      items: [rectItem("a", 20, 40)],
    });
  });

  test("respects min and max canvas size", () => {
    expect(
      resizeSeatCanvas({
        width: MIN_CANVAS_SIZE,
        height: MIN_CANVAS_SIZE,
        items: [],
        edge: "e",
        deltaCells: -1,
      }),
    ).toBeNull();
    expect(
      resizeSeatCanvas({
        width: MAX_CANVAS_SIZE,
        height: 500,
        items: [],
        edge: "e",
        deltaCells: 1,
      }),
    ).toBeNull();
  });
});

describe("canvasResizePanDelta", () => {
  test("keeps east/south controls fixed at front orientation", () => {
    expect(canvasResizePanDelta("e", 1, "front")).toEqual({
      x: -CANVAS_RESIZE_STEP,
      y: 0,
    });
    expect(canvasResizePanDelta("s", 1, "front")).toEqual({
      x: 0,
      y: -CANVAS_RESIZE_STEP,
    });
    expect(canvasResizePanDelta("e", -1, "front")).toEqual({
      x: CANVAS_RESIZE_STEP,
      y: 0,
    });
    expect(canvasResizePanDelta("s", -1, "front")).toEqual({
      x: 0,
      y: CANVAS_RESIZE_STEP,
    });
  });

  test("leaves west/north controls unmoved at front orientation", () => {
    expect(canvasResizePanDelta("w", 1, "front")).toEqual({ x: 0, y: 0 });
    expect(canvasResizePanDelta("n", 1, "front")).toEqual({ x: 0, y: 0 });
    expect(canvasResizePanDelta("w", -1, "front")).toEqual({ x: 0, y: 0 });
    expect(canvasResizePanDelta("n", -1, "front")).toEqual({ x: 0, y: 0 });
  });

  test("accounts for rotated views", () => {
    expect(canvasResizePanDelta("e", 1, "back")).toEqual({ x: 0, y: 0 });
    expect(canvasResizePanDelta("e", 1, "right")).toEqual({
      x: -CANVAS_RESIZE_STEP / 2,
      y: -CANVAS_RESIZE_STEP / 2,
    });
    expect(canvasResizePanDelta("s", 1, "right")).toEqual({
      x: CANVAS_RESIZE_STEP / 2,
      y: -CANVAS_RESIZE_STEP / 2,
    });
  });
});

describe("buildDeskGrid", () => {
  test("lays out a row-major grid with sequential desk numbers", () => {
    let n = 0;
    const items = buildDeskGrid({
      cols: 3,
      rows: 2,
      startDeskNumber: 5,
      originX: 40,
      originY: 60,
      createId: () => `d${(n += 1)}`,
    });
    expect(items).toHaveLength(6);
    expect(items.map((item) => item.deskNumber)).toEqual([5, 6, 7, 8, 9, 10]);
    expect(items[0]).toMatchObject({
      id: "d1",
      kind: "desk",
      x: 40,
      y: 60,
      width: DEFAULT_DESK_WIDTH,
      height: DEFAULT_DESK_HEIGHT,
    });
    expect(items[2]).toMatchObject({ x: 40 + 2 * (DEFAULT_DESK_WIDTH + 20), y: 60 });
    expect(items[3]).toMatchObject({ x: 40, y: 60 + DEFAULT_DESK_HEIGHT + 20 });
  });

  test("respects the per-add desk ceiling", () => {
    let n = 0;
    const items = buildDeskGrid({
      cols: 12,
      rows: 8,
      startDeskNumber: 1,
      originX: 0,
      originY: 0,
      createId: () => `d${(n += 1)}`,
    });
    expect(items.length).toBeLessThanOrEqual(MAX_DESKS_PER_ADD);
    expect(items.length).toBe(36);
  });

  test("deskGridBlockSize matches occupied area", () => {
    expect(deskGridBlockSize(4, 1)).toEqual({
      width: 4 * DEFAULT_DESK_WIDTH + 3 * SEAT_CANVAS_GRID_SIZE,
      height: DEFAULT_DESK_HEIGHT,
    });
  });
});
