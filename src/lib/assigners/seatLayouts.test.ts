import { describe, expect, test } from "vite-plus/test";

import {
  buildDeskGrid,
  canvasResizePanDelta,
  clampDeskGridDims,
  CANVAS_RESIZE_STEP,
  commonTeamAssignment,
  commonZoneName,
  compressSeatItemGaps,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_DESK_HEIGHT,
  DEFAULT_DESK_WIDTH,
  deskGridBlockSize,
  deskSizeForGroupCount,
  listZoneNames,
  MAX_CANVAS_SIZE,
  MAX_DESKS_PER_ADD,
  MIN_CANVAS_SIZE,
  nextPlacementOrigin,
  nextSeatLayoutSortState,
  placeBlockOnCanvas,
  resizeCursorForEdge,
  resizeSeatCanvas,
  rotateSeatRectForOrientation,
  SEAT_CANVAS_GRID_SIZE,
  sortSeatLayouts,
  topLeftPlacementOrigin,
  seatItemDisplayLabel,
  teamAssignmentsEqual,
  uprightSeatContentBox,
  zoneSeatCounts,
  type SeatLayoutItem,
  type SeatLayoutListItem,
} from "@/lib/assigners/seatLayouts";
import type { Id } from "../../../convex/_generated/dataModel";

function rectItem(id: string, x: number, y: number, width = 80, height = 60): SeatLayoutItem {
  return { id, kind: "rect", label: "", x, y, width, height };
}

function deskItem(
  id: string,
  extras: Partial<SeatLayoutItem> & { deskNumber?: number } = {},
): SeatLayoutItem {
  return {
    id,
    kind: "desk",
    label: "",
    deskNumber: extras.deskNumber ?? 1,
    x: extras.x ?? 0,
    y: extras.y ?? 0,
    width: extras.width ?? DEFAULT_DESK_WIDTH,
    height: extras.height ?? DEFAULT_DESK_HEIGHT,
    ...extras,
  };
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

describe("commonZoneName", () => {
  test("returns shared zone name", () => {
    expect(commonZoneName([{ zoneName: "Front" }, { zoneName: " Front " }])).toBe("Front");
  });

  test("returns undefined when mixed, empty, or unset", () => {
    expect(commonZoneName([])).toBeUndefined();
    expect(commonZoneName([{ zoneName: "A" }, { zoneName: "B" }])).toBeUndefined();
    expect(commonZoneName([{ zoneName: "A" }, { zoneName: undefined }])).toBeUndefined();
    expect(commonZoneName([{ zoneName: undefined }, { zoneName: "  " }])).toBeUndefined();
  });
});

describe("listZoneNames", () => {
  test("returns unique sorted names from desks only", () => {
    expect(
      listZoneNames([
        deskItem("1", { zoneName: "Back", deskNumber: 1 }),
        deskItem("2", { zoneName: "Front", deskNumber: 2 }),
        deskItem("3", { zoneName: "Back", deskNumber: 3 }),
        deskItem("4", { deskNumber: 4 }),
        rectItem("r", 0, 0),
        { ...rectItem("r2", 0, 0), zoneName: "Ignored" },
      ]),
    ).toEqual(["Back", "Front"]);
  });
});

describe("zoneSeatCounts", () => {
  test("counts desks per zone and omits unzoned", () => {
    expect(
      zoneSeatCounts([
        deskItem("1", { zoneName: "A", deskNumber: 1 }),
        deskItem("2", { zoneName: "A", deskNumber: 2 }),
        deskItem("3", { zoneName: "B", deskNumber: 3 }),
        deskItem("4", { deskNumber: 4 }),
        rectItem("r", 0, 0),
      ]),
    ).toEqual({ A: 2, B: 1 });
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
  test("defaults are 30 grid cells", () => {
    expect(DEFAULT_CANVAS_WIDTH).toBe(SEAT_CANVAS_GRID_SIZE * 30);
    expect(DEFAULT_CANVAS_HEIGHT).toBe(SEAT_CANVAS_GRID_SIZE * 30);
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

describe("rotateSeatRectForOrientation", () => {
  const rect = { x: 10, y: 20, width: 40, height: 30 };

  test("front is identity", () => {
    expect(rotateSeatRectForOrientation(rect, 200, 100, "front")).toEqual(rect);
  });

  test("right maps top-left toward top-right and swaps size", () => {
    expect(rotateSeatRectForOrientation(rect, 200, 100, "right")).toEqual({
      x: 50,
      y: 10,
      width: 30,
      height: 40,
    });
  });

  test("left maps top-left toward bottom-left and swaps size", () => {
    expect(rotateSeatRectForOrientation(rect, 200, 100, "left")).toEqual({
      x: 20,
      y: 150,
      width: 30,
      height: 40,
    });
  });

  test("back flips without swapping size", () => {
    expect(rotateSeatRectForOrientation(rect, 200, 100, "back")).toEqual({
      x: 150,
      y: 50,
      width: 40,
      height: 30,
    });
  });
});

describe("uprightSeatContentBox", () => {
  test("keeps size for front and back", () => {
    expect(uprightSeatContentBox(80, 60, "front")).toEqual({ width: 80, height: 60 });
    expect(uprightSeatContentBox(80, 60, "back")).toEqual({ width: 80, height: 60 });
  });

  test("swaps size for left and right so labels wrap to the visual desk", () => {
    expect(uprightSeatContentBox(80, 60, "left")).toEqual({ width: 60, height: 80 });
    expect(uprightSeatContentBox(80, 60, "right")).toEqual({ width: 60, height: 80 });
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

  test("deskGridBlockSize uses groupCount for desk height", () => {
    const single = deskSizeForGroupCount(1);
    expect(deskGridBlockSize(2, 2, SEAT_CANVAS_GRID_SIZE, SEAT_CANVAS_GRID_SIZE, 1)).toEqual({
      width: 2 * single.width + SEAT_CANVAS_GRID_SIZE,
      height: 2 * single.height + SEAT_CANVAS_GRID_SIZE,
    });
  });
});

describe("placeBlockOnCanvas", () => {
  test("uses nextPlacementOrigin when the stacked block fits", () => {
    const items = [rectItem("a", 40, 40, 100, 60)];
    const result = placeBlockOnCanvas({
      items,
      blockWidth: 100,
      blockHeight: 60,
      canvasWidth: DEFAULT_CANVAS_WIDTH,
      canvasHeight: DEFAULT_CANVAS_HEIGHT,
    });
    expect(result.origin).toEqual(nextPlacementOrigin(items));
    expect(result.canvasWidth).toBe(DEFAULT_CANVAS_WIDTH);
    expect(result.canvasHeight).toBe(DEFAULT_CANVAS_HEIGHT);
  });

  test("falls back to top-left when stacking would leave the canvas", () => {
    const items = [rectItem("a", 40, DEFAULT_CANVAS_HEIGHT - 80, 100, 60)];
    const result = placeBlockOnCanvas({
      items,
      blockWidth: 100,
      blockHeight: 60,
      canvasWidth: DEFAULT_CANVAS_WIDTH,
      canvasHeight: DEFAULT_CANVAS_HEIGHT,
    });
    expect(result.origin).toEqual(topLeftPlacementOrigin());
    expect(result.canvasWidth).toBe(DEFAULT_CANVAS_WIDTH);
    expect(result.canvasHeight).toBe(DEFAULT_CANVAS_HEIGHT);
  });

  test("grows the canvas south when the block cannot fit at top-left either", () => {
    const items = [rectItem("a", 40, 40, 100, 60)];
    const result = placeBlockOnCanvas({
      items,
      blockWidth: DEFAULT_CANVAS_WIDTH,
      blockHeight: DEFAULT_CANVAS_HEIGHT,
      canvasWidth: DEFAULT_CANVAS_WIDTH,
      canvasHeight: DEFAULT_CANVAS_HEIGHT,
    });
    const stacked = nextPlacementOrigin(items);
    expect(result.origin).toEqual(stacked);
    expect(result.canvasWidth).toBeGreaterThan(DEFAULT_CANVAS_WIDTH);
    expect(result.canvasHeight).toBeGreaterThan(DEFAULT_CANVAS_HEIGHT);
    expect(result.origin.x + DEFAULT_CANVAS_WIDTH).toBeLessThanOrEqual(result.canvasWidth);
    expect(result.origin.y + DEFAULT_CANVAS_HEIGHT).toBeLessThanOrEqual(result.canvasHeight);
    expect(result.canvasHeight).toBeLessThanOrEqual(MAX_CANVAS_SIZE);
  });
});

describe("resizeCursorForEdge", () => {
  test("maps n/s to ns-resize when the board faces front", () => {
    expect(resizeCursorForEdge("n", "front")).toBe("ns-resize");
    expect(resizeCursorForEdge("e", "front")).toBe("ew-resize");
    expect(resizeCursorForEdge("s", "back")).toBe("ns-resize");
  });

  test("swaps axes when the board is rotated 90 degrees", () => {
    expect(resizeCursorForEdge("n", "right")).toBe("ew-resize");
    expect(resizeCursorForEdge("e", "right")).toBe("ns-resize");
    expect(resizeCursorForEdge("n", "left")).toBe("ew-resize");
    expect(resizeCursorForEdge("w", "left")).toBe("ns-resize");
  });
});

function listItem(
  overrides: Pick<SeatLayoutListItem, "name" | "_creationTime" | "updatedAt"> &
    Partial<SeatLayoutListItem>,
): SeatLayoutListItem {
  return {
    _id: "layout1" as Id<"seatLayouts">,
    deskCount: 0,
    itemCount: 0,
    ...overrides,
  };
}

describe("sortSeatLayouts", () => {
  const layouts = [
    listItem({
      _id: "a" as Id<"seatLayouts">,
      name: "Beta",
      _creationTime: 100,
      updatedAt: 300,
    }),
    listItem({
      _id: "b" as Id<"seatLayouts">,
      name: "Alpha",
      _creationTime: 200,
      updatedAt: 100,
    }),
    listItem({
      _id: "c" as Id<"seatLayouts">,
      name: "alpha",
      _creationTime: 150,
      updatedAt: 200,
    }),
  ];

  test("sorts by name ascending case-insensitively", () => {
    expect(sortSeatLayouts(layouts, "name", "asc").map((l) => l._id)).toEqual(["b", "c", "a"]);
  });

  test("sorts by updated descending", () => {
    expect(sortSeatLayouts(layouts, "updated", "desc").map((l) => l._id)).toEqual(["a", "c", "b"]);
  });

  test("sorts by created ascending", () => {
    expect(sortSeatLayouts(layouts, "created", "asc").map((l) => l._id)).toEqual(["a", "c", "b"]);
  });
});

describe("nextSeatLayoutSortState", () => {
  test("flips direction when the same key is selected", () => {
    expect(nextSeatLayoutSortState("updated", "desc", "updated")).toEqual({
      sortKey: "updated",
      sortDirection: "asc",
    });
  });

  test("defaults name to asc and dates to desc", () => {
    expect(nextSeatLayoutSortState("updated", "desc", "name")).toEqual({
      sortKey: "name",
      sortDirection: "asc",
    });
    expect(nextSeatLayoutSortState("name", "asc", "created")).toEqual({
      sortKey: "created",
      sortDirection: "desc",
    });
  });
});

describe("compressSeatItemGaps", () => {
  test("collapses oversized gutters while keeping item sizes", () => {
    const compressed = compressSeatItemGaps(
      [
        { id: "a", x: 0, y: 0, width: 100, height: 40 },
        { id: "b", x: 300, y: 200, width: 100, height: 40 },
      ],
      { maxGapX: 20, maxGapY: 20 },
    );
    expect(compressed[0]).toEqual({ id: "a", x: 0, y: 0, width: 100, height: 40 });
    expect(compressed[1]).toEqual({ id: "b", x: 120, y: 60, width: 100, height: 40 });
  });

  test("leaves already-tight gaps alone", () => {
    const items = [
      { id: "a", x: 0, y: 0, width: 100, height: 40 },
      { id: "b", x: 120, y: 0, width: 100, height: 40 },
    ];
    expect(compressSeatItemGaps(items, { maxGapX: 20, maxGapY: 20 })).toEqual(items);
  });
});
