import type { FunctionReturnType } from "convex/server";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type SeatLayoutList = FunctionReturnType<typeof api.seatLayouts.list>;
export type SeatLayoutListItem = SeatLayoutList[number];
export type SeatLayout = NonNullable<FunctionReturnType<typeof api.seatLayouts.get>>;
export type SeatLayoutItem = SeatLayout["items"][number];
export type SeatLayoutItemKind = SeatLayoutItem["kind"];
export type SeatTeamAssignment = NonNullable<SeatLayoutItem["teamAssignment"]>;

export type SeatLayoutSortKey = "name" | "created" | "updated";
export type SeatLayoutSortDirection = "asc" | "desc";

export function compareSeatLayouts(
  a: SeatLayoutListItem,
  b: SeatLayoutListItem,
  sortKey: SeatLayoutSortKey,
  direction: SeatLayoutSortDirection,
): number {
  const dir = direction === "asc" ? 1 : -1;
  switch (sortKey) {
    case "name": {
      const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      if (byName !== 0) return byName * dir;
      return (a.updatedAt - b.updatedAt) * dir;
    }
    case "created":
      return (a._creationTime - b._creationTime) * dir;
    case "updated":
      return (a.updatedAt - b.updatedAt) * dir;
  }
}

export function sortSeatLayouts(
  layouts: readonly SeatLayoutListItem[],
  sortKey: SeatLayoutSortKey,
  direction: SeatLayoutSortDirection,
): SeatLayoutListItem[] {
  return [...layouts].sort((a, b) => compareSeatLayouts(a, b, sortKey, direction));
}

export function nextSeatLayoutSortState(
  currentKey: SeatLayoutSortKey,
  currentDirection: SeatLayoutSortDirection,
  nextKey: SeatLayoutSortKey,
): { sortKey: SeatLayoutSortKey; sortDirection: SeatLayoutSortDirection } {
  if (currentKey === nextKey) {
    return {
      sortKey: currentKey,
      sortDirection: currentDirection === "asc" ? "desc" : "asc",
    };
  }
  return {
    sortKey: nextKey,
    sortDirection: nextKey === "name" ? "asc" : "desc",
  };
}

export type SeatOrientation = "front" | "back" | "left" | "right";

export const SEAT_ORIENTATION_DEGREES: Record<SeatOrientation, number> = {
  front: 0,
  back: 180,
  left: 270,
  right: 90,
};

export const SEAT_ORIENTATION_LABEL_KEYS = {
  front: "orientationFront",
  back: "orientationBack",
  left: "orientationLeft",
  right: "orientationRight",
} as const;

/** English defaults previously persisted into item.label before display-time i18n. */
const LEGACY_DEFAULT_LABELS: Record<SeatLayoutItemKind, ReadonlySet<string>> = {
  desk: new Set(),
  teacherDesk: new Set(["Teacher's desk", "Teacher’s desk"]),
  board: new Set(["Board"]),
  rect: new Set(["Label", "Custom"]),
};

export type SeatItemDefaultLabels = {
  teacherDesk: string;
  board: string;
  rect: string;
};

/**
 * Label shown on the canvas / print. Empty or legacy English defaults resolve
 * to the current locale's kind default so the UI tracks language changes.
 */
export function seatItemDisplayLabel(
  item: Pick<SeatLayoutItem, "kind" | "label">,
  defaults: SeatItemDefaultLabels,
): string {
  const trimmed = item.label.trim();
  const kindDefault =
    item.kind === "teacherDesk"
      ? defaults.teacherDesk
      : item.kind === "board"
        ? defaults.board
        : item.kind === "rect"
          ? defaults.rect
          : "";

  if (!trimmed) return kindDefault;
  if (LEGACY_DEFAULT_LABELS[item.kind].has(trimmed)) return kindDefault;
  return trimmed;
}

/** Canvas background grid spacing (editor only). */
export const SEAT_CANVAS_GRID_SIZE = 20;

/** Default new-layout size in grid cells (width × height). */
export const DEFAULT_CANVAS_CELLS = 30;
export const DEFAULT_CANVAS_WIDTH = SEAT_CANVAS_GRID_SIZE * DEFAULT_CANVAS_CELLS;
export const DEFAULT_CANVAS_HEIGHT = SEAT_CANVAS_GRID_SIZE * DEFAULT_CANVAS_CELLS;
export const CANVAS_RESIZE_STEP = SEAT_CANVAS_GRID_SIZE;
/** Match Convex `seatLayouts` canvas clamps. */
export const MIN_CANVAS_SIZE = 200;
export const MAX_CANVAS_SIZE = 4000;

export type SeatCanvasEdge = "n" | "e" | "s" | "w";

export type SeatCanvasResizeResult = {
  width: number;
  height: number;
  items: Array<SeatLayoutItem>;
};

/**
 * Grow/shrink the canvas by `deltaCells` on one edge.
 * West/north growth shifts items so content stays visually anchored.
 * Returns `null` when the change would clip items or exceed size limits.
 */
export function resizeSeatCanvas(options: {
  width: number;
  height: number;
  items: Array<SeatLayoutItem>;
  edge: SeatCanvasEdge;
  deltaCells: number;
}): SeatCanvasResizeResult | null {
  const deltaCells = Math.trunc(options.deltaCells);
  if (deltaCells === 0) return null;

  const step = CANVAS_RESIZE_STEP * deltaCells;
  const { edge, items } = options;
  let width = options.width;
  let height = options.height;
  let nextItems = items;

  const contentRight = items.reduce((max, item) => Math.max(max, item.x + item.width), 0);
  const contentBottom = items.reduce((max, item) => Math.max(max, item.y + item.height), 0);
  const minLeft = items.reduce((min, item) => Math.min(min, item.x), Infinity);
  const minTop = items.reduce((min, item) => Math.min(min, item.y), Infinity);

  if (edge === "e") {
    width = options.width + step;
  } else if (edge === "s") {
    height = options.height + step;
  } else if (edge === "w") {
    if (step < 0) {
      const shrink = -step;
      if (items.length > 0 && minLeft < shrink) return null;
      nextItems = items.map((item) => ({ ...item, x: item.x - shrink }));
    } else {
      nextItems = items.map((item) => ({ ...item, x: item.x + step }));
    }
    width = options.width + step;
  } else {
    // north
    if (step < 0) {
      const shrink = -step;
      if (items.length > 0 && minTop < shrink) return null;
      nextItems = items.map((item) => ({ ...item, y: item.y - shrink }));
    } else {
      nextItems = items.map((item) => ({ ...item, y: item.y + step }));
    }
    height = options.height + step;
  }

  if (width < MIN_CANVAS_SIZE || height < MIN_CANVAS_SIZE) return null;
  if (width > MAX_CANVAS_SIZE || height > MAX_CANVAS_SIZE) return null;

  if (items.length > 0) {
    if (edge === "e" && step < 0 && width < contentRight) return null;
    if (edge === "s" && step < 0 && height < contentBottom) return null;
  }

  if (width === options.width && height === options.height) return null;

  return { width, height, items: nextItems };
}

/**
 * Pan delta that keeps the resized-edge controls under the cursor.
 *
 * The editor canvas is top-left anchored and may be CSS-rotated around its
 * center. East/south controls sit on the growing edge, so without compensation
 * they drift away from the pointer; west/north stay put at 0° but still need
 * a correction when the view is rotated.
 */
export function canvasResizePanDelta(
  edge: SeatCanvasEdge,
  deltaCells: number,
  orientation: SeatOrientation,
): { x: number; y: number } {
  const step = CANVAS_RESIZE_STEP * Math.trunc(deltaCells);
  if (step === 0) return { x: 0, y: 0 };

  const rad = (SEAT_ORIENTATION_DEGREES[orientation] * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // CSS rotate() with y-down: (x, y) → (x cos − y sin, x sin + y cos).
  const rotate = (x: number, y: number) => ({
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  });

  const halfX = edge === "e" || edge === "w" ? step / 2 : 0;
  const halfY = edge === "n" || edge === "s" ? step / 2 : 0;
  const rotated = rotate(halfX, halfY);

  // Moving edges (e/s): local control shifts by the full step → half + R(half).
  // Anchored edges (w/n): local control stays put → half − R(half).
  const raw =
    edge === "e" || edge === "s"
      ? { x: -(halfX + rotated.x), y: -(halfY + rotated.y) }
      : { x: -(halfX - rotated.x), y: -(halfY - rotated.y) };

  const snap = (value: number) => (Math.abs(value) < 1e-10 ? 0 : value);
  return { x: snap(raw.x), y: snap(raw.y) };
}

/** Default sizes are exact multiples of `SEAT_CANVAS_GRID_SIZE`. */
export const DESK_SLOT_HEIGHT = SEAT_CANVAS_GRID_SIZE * 2;
export const DEFAULT_DESK_WIDTH = SEAT_CANVAS_GRID_SIZE * 5;
export const DEFAULT_DESK_HEIGHT = DESK_SLOT_HEIGHT * 2 + SEAT_CANVAS_GRID_SIZE;
export function deskSizeForGroupCount(groupCount: number): { width: number; height: number } {
  const slots = Math.max(1, groupCount);
  return {
    width: DEFAULT_DESK_WIDTH,
    height: DESK_SLOT_HEIGHT * slots + SEAT_CANVAS_GRID_SIZE,
  };
}
export const DEFAULT_TEACHER_DESK_WIDTH = SEAT_CANVAS_GRID_SIZE * 7;
export const DEFAULT_TEACHER_DESK_HEIGHT = SEAT_CANVAS_GRID_SIZE * 4;
export const DEFAULT_BOARD_WIDTH = SEAT_CANVAS_GRID_SIZE * 11;
export const DEFAULT_BOARD_HEIGHT = SEAT_CANVAS_GRID_SIZE * 2;
export const DEFAULT_RECT_WIDTH = SEAT_CANVAS_GRID_SIZE * 6;
export const DEFAULT_RECT_HEIGHT = SEAT_CANVAS_GRID_SIZE * 4;

/** Limits for the desk-grid placer in the layout editor. */
export const MAX_DESKS_PER_ADD = 40;
export const MAX_DESK_GRID_COLS = 12;
export const MAX_DESK_GRID_ROWS = 8;

export function newItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `item_${Math.random().toString(36).slice(2, 12)}`;
}

export function defaultSizeForKind(
  kind: SeatLayoutItemKind,
  options?: { groupCount?: number },
): {
  width: number;
  height: number;
} {
  switch (kind) {
    case "desk":
      return deskSizeForGroupCount(options?.groupCount ?? 2);
    case "teacherDesk":
      return { width: DEFAULT_TEACHER_DESK_WIDTH, height: DEFAULT_TEACHER_DESK_HEIGHT };
    case "board":
      return { width: DEFAULT_BOARD_WIDTH, height: DEFAULT_BOARD_HEIGHT };
    case "rect":
      return { width: DEFAULT_RECT_WIDTH, height: DEFAULT_RECT_HEIGHT };
  }
}

/** Clamp grid dims to editor limits and the per-add desk ceiling. */
export function clampDeskGridDims(cols: number, rows: number): { cols: number; rows: number } {
  let nextCols = Math.min(
    MAX_DESK_GRID_COLS,
    Math.max(1, Math.floor(Number.isFinite(cols) ? cols : 1) || 1),
  );
  let nextRows = Math.min(
    MAX_DESK_GRID_ROWS,
    Math.max(1, Math.floor(Number.isFinite(rows) ? rows : 1) || 1),
  );
  while (nextCols * nextRows > MAX_DESKS_PER_ADD) {
    if (nextRows > 1) {
      nextRows -= 1;
    } else {
      nextCols -= 1;
    }
  }
  return { cols: nextCols, rows: nextRows };
}

export function deskGridBlockSize(
  cols: number,
  rows: number,
  gapX = SEAT_CANVAS_GRID_SIZE,
  gapY = SEAT_CANVAS_GRID_SIZE,
  groupCount = 2,
): { width: number; height: number } {
  const dims = clampDeskGridDims(cols, rows);
  const deskSize = deskSizeForGroupCount(groupCount);
  return {
    width: dims.cols * deskSize.width + Math.max(0, dims.cols - 1) * gapX,
    height: dims.rows * deskSize.height + Math.max(0, dims.rows - 1) * gapY,
  };
}

/** Padded upper-left origin used when adding palette items. */
export function topLeftPlacementOrigin(): { x: number; y: number } {
  const grid = SEAT_CANVAS_GRID_SIZE;
  return { x: grid * 2, y: grid * 2 };
}

/**
 * Origin for the next placed block: top-left padding when empty, otherwise
 * directly under the lowest existing item (snapped to the canvas grid).
 */
export function nextPlacementOrigin(
  items: Array<Pick<SeatLayoutItem, "x" | "y" | "width" | "height">>,
): { x: number; y: number } {
  if (items.length === 0) {
    return topLeftPlacementOrigin();
  }
  const grid = SEAT_CANVAS_GRID_SIZE;
  let maxBottom = 0;
  for (const item of items) {
    maxBottom = Math.max(maxBottom, item.y + item.height);
  }
  const y = Math.ceil((maxBottom + grid) / grid) * grid;
  return { x: grid * 2, y };
}

function snapCanvasSize(value: number): number {
  return Math.min(
    MAX_CANVAS_SIZE,
    Math.max(MIN_CANVAS_SIZE, Math.ceil(value / SEAT_CANVAS_GRID_SIZE) * SEAT_CANVAS_GRID_SIZE),
  );
}

function originFitsCanvas(
  origin: { x: number; y: number },
  blockWidth: number,
  blockHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): boolean {
  return (
    origin.x >= 0 &&
    origin.y >= 0 &&
    origin.x + blockWidth <= canvasWidth &&
    origin.y + blockHeight <= canvasHeight
  );
}

/**
 * Pick an origin for a new block that stays on the canvas when possible.
 * Tries stacking below existing items, then the padded top-left. If the block
 * still cannot fit, grow the canvas east/south (snapped to the grid).
 */
export function placeBlockOnCanvas(options: {
  items: Array<Pick<SeatLayoutItem, "x" | "y" | "width" | "height">>;
  blockWidth: number;
  blockHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}): {
  origin: { x: number; y: number };
  canvasWidth: number;
  canvasHeight: number;
} {
  const stacked = nextPlacementOrigin(options.items);
  const topLeft = topLeftPlacementOrigin();
  if (
    originFitsCanvas(
      stacked,
      options.blockWidth,
      options.blockHeight,
      options.canvasWidth,
      options.canvasHeight,
    )
  ) {
    return {
      origin: stacked,
      canvasWidth: options.canvasWidth,
      canvasHeight: options.canvasHeight,
    };
  }
  if (
    originFitsCanvas(
      topLeft,
      options.blockWidth,
      options.blockHeight,
      options.canvasWidth,
      options.canvasHeight,
    )
  ) {
    return {
      origin: topLeft,
      canvasWidth: options.canvasWidth,
      canvasHeight: options.canvasHeight,
    };
  }

  const stackedFitsMax =
    stacked.x + options.blockWidth <= MAX_CANVAS_SIZE &&
    stacked.y + options.blockHeight <= MAX_CANVAS_SIZE;
  const origin = stackedFitsMax ? stacked : topLeft;
  return {
    origin,
    canvasWidth: snapCanvasSize(Math.max(options.canvasWidth, origin.x + options.blockWidth)),
    canvasHeight: snapCanvasSize(Math.max(options.canvasHeight, origin.y + options.blockHeight)),
  };
}

/** Screen cursor for a layout-space resize edge after the board is rotated. */
export function resizeCursorForEdge(
  edge: SeatCanvasEdge,
  orientation: SeatOrientation,
): "ns-resize" | "ew-resize" {
  const swapped = SEAT_ORIENTATION_DEGREES[orientation] % 180 === 90;
  const isNs = edge === "n" || edge === "s";
  return isNs !== swapped ? "ns-resize" : "ew-resize";
}

export function buildDeskGrid(options: {
  cols: number;
  rows: number;
  startDeskNumber: number;
  originX: number;
  originY: number;
  gapX?: number;
  gapY?: number;
  groupCount?: number;
  createId?: () => string;
}): Array<SeatLayoutItem> {
  const { cols, rows } = clampDeskGridDims(options.cols, options.rows);
  const gapX = options.gapX ?? SEAT_CANVAS_GRID_SIZE;
  const gapY = options.gapY ?? SEAT_CANVAS_GRID_SIZE;
  const createId = options.createId ?? newItemId;
  const deskSize = deskSizeForGroupCount(options.groupCount ?? 2);
  const items: Array<SeatLayoutItem> = [];
  let deskNumber = options.startDeskNumber;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      items.push({
        id: createId(),
        kind: "desk",
        label: "",
        deskNumber,
        x: options.originX + col * (deskSize.width + gapX),
        y: options.originY + row * (deskSize.height + gapY),
        width: deskSize.width,
        height: deskSize.height,
      });
      deskNumber += 1;
    }
  }
  return items;
}

export function teamAssignmentsEqual(
  a: SeatTeamAssignment | undefined,
  b: SeatTeamAssignment | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.mode !== b.mode) return false;
  if (a.mode === "byName" && b.mode === "byName") {
    return a.teamName.trim().toLowerCase() === b.teamName.trim().toLowerCase();
  }
  if (a.mode === "single" && b.mode === "single") {
    return a.groupId === b.groupId && a.teamId === b.teamId;
  }
  return false;
}

/** Shared assignment when every desk matches; otherwise undefined (mixed / none). */
export function commonTeamAssignment(
  desks: Array<Pick<SeatLayoutItem, "teamAssignment">>,
): SeatTeamAssignment | undefined {
  const first = desks[0]?.teamAssignment;
  if (desks.length === 0) return undefined;
  if (!desks.every((desk) => teamAssignmentsEqual(desk.teamAssignment, first))) {
    return undefined;
  }
  return first;
}

export function resolveTeamLabel(
  assignment: SeatTeamAssignment | undefined,
  groups: Array<{
    _id: Id<"groups">;
    name: string;
    teams: Array<{ _id: Id<"teams">; name: string }>;
  }>,
): { label: string; stale: boolean } | null {
  if (!assignment) return null;
  if (assignment.mode === "byName") {
    const matches = groups.flatMap((group) =>
      group.teams
        .filter(
          (team) => team.name.trim().toLowerCase() === assignment.teamName.trim().toLowerCase(),
        )
        .map((team) => ({ groupName: group.name, teamName: team.name })),
    );
    if (matches.length === 0) {
      return { label: assignment.teamName, stale: true };
    }
    return { label: assignment.teamName, stale: false };
  }

  const group = groups.find((g) => g._id === assignment.groupId);
  const team = group?.teams.find((t) => t._id === assignment.teamId);
  if (!group || !team) {
    return { label: "", stale: true };
  }
  return { label: `${group.name} / ${team.name}`, stale: false };
}

/** Team names that appear in 2+ groups (case-insensitive). */
export function sharedTeamNames(
  groups: Array<{ name: string; teams: Array<{ name: string }> }>,
): Array<{ teamName: string; groupNames: Array<string> }> {
  const byKey = new Map<string, { teamName: string; groupNames: Array<string> }>();
  for (const group of groups) {
    const seenInGroup = new Set<string>();
    for (const team of group.teams) {
      const key = team.name.trim().toLowerCase();
      if (!key || seenInGroup.has(key)) continue;
      seenInGroup.add(key);
      const entry = byKey.get(key);
      if (entry) {
        entry.groupNames.push(group.name);
      } else {
        byKey.set(key, { teamName: team.name.trim(), groupNames: [group.name] });
      }
    }
  }
  return [...byKey.values()]
    .filter((entry) => entry.groupNames.length >= 2)
    .sort((a, b) => a.teamName.localeCompare(b.teamName));
}

function normalizeZoneNameValue(zoneName: string | undefined): string | undefined {
  if (zoneName === undefined) return undefined;
  const trimmed = zoneName.trim();
  return trimmed || undefined;
}

/** Shared zone when every desk matches (case-sensitive trim); otherwise undefined. */
export function commonZoneName(desks: Array<Pick<SeatLayoutItem, "zoneName">>): string | undefined {
  if (desks.length === 0) return undefined;
  const first = normalizeZoneNameValue(desks[0]?.zoneName);
  if (!desks.every((desk) => normalizeZoneNameValue(desk.zoneName) === first)) {
    return undefined;
  }
  return first;
}

/** Unique trimmed zone names on desks, sorted for suggestion lists. */
export function listZoneNames(
  items: Array<Pick<SeatLayoutItem, "kind" | "zoneName">>,
): Array<string> {
  const names = new Set<string>();
  for (const item of items) {
    if (item.kind !== "desk") continue;
    const name = normalizeZoneNameValue(item.zoneName);
    if (name) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Desk counts per zone name. Unzoned desks are omitted. */
export function zoneSeatCounts(
  items: Array<Pick<SeatLayoutItem, "kind" | "zoneName">>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    if (item.kind !== "desk") continue;
    const name = normalizeZoneNameValue(item.zoneName);
    if (!name) continue;
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
}

function mergeAxisIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [[sorted[0]![0], sorted[0]![1]]];
  for (let i = 1; i < sorted.length; i++) {
    const [start, end] = sorted[i]!;
    const last = merged[merged.length - 1]!;
    if (start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

/**
 * Map axis coordinates so empty gaps between occupied bands are at most `maxGap`.
 * Item sizes are unchanged; only positions move closer together.
 */
function buildAxisGapCollapseShift(
  intervals: Array<[number, number]>,
  maxGap: number,
): (value: number) => number {
  const merged = mergeAxisIntervals(intervals);
  if (merged.length <= 1) return (value) => value;

  const blockShift: Array<number> = [0];
  let cumulative = 0;
  for (let i = 0; i < merged.length - 1; i++) {
    const gap = merged[i + 1]![0] - merged[i]![1];
    cumulative += Math.max(0, gap - maxGap);
    blockShift.push(cumulative);
  }

  return (value: number) => {
    for (let i = 0; i < merged.length - 1; i++) {
      const gapStart = merged[i]![1];
      const gapEnd = merged[i + 1]![0];
      if (value > gapStart && value < gapEnd) {
        const intoGap = value - gapStart;
        return gapStart - blockShift[i]! + Math.min(intoGap, maxGap);
      }
    }
    let shift = 0;
    for (let i = 0; i < merged.length; i++) {
      if (value >= merged[i]![0]) shift = blockShift[i]!;
    }
    return value - shift;
  };
}

/**
 * Collapse oversized empty gutters between layout items (display-only).
 * Preserves relative cluster order and item sizes.
 */
export function compressSeatItemGaps<
  T extends { x: number; y: number; width: number; height: number },
>(items: Array<T>, options?: { maxGapX?: number; maxGapY?: number }): Array<T> {
  if (items.length <= 1) return items.map((item) => ({ ...item }));

  const maxGapX = options?.maxGapX ?? SEAT_CANVAS_GRID_SIZE;
  const maxGapY = options?.maxGapY ?? SEAT_CANVAS_GRID_SIZE;
  const shiftX = buildAxisGapCollapseShift(
    items.map((item) => [item.x, item.x + item.width]),
    maxGapX,
  );
  const shiftY = buildAxisGapCollapseShift(
    items.map((item) => [item.y, item.y + item.height]),
    maxGapY,
  );

  return items.map((item) => ({
    ...item,
    x: shiftX(item.x),
    y: shiftY(item.y),
  }));
}
