import type { Doc, Id } from "../../_generated/dataModel.js";
import type { SeatLayoutItemSnapshot } from "../seatChartGeometry.js";
import type { GenderBucket, SeatingStudent } from "./types.js";

export const DESK_SIZE = 40;
export const TEST_CLASSROOM_LAYOUT_ID = "layout-classroom" as Id<"seatLayouts">;
export const TEST_CLASSROOM_GROUP_ID = "group-classroom" as Id<"groups">;
export const TEST_CLASSROOM_GROUP_B_ID = "group-classroom-b" as Id<"groups">;
export const TEST_TEAM_BLUE = "team-blue" as Id<"teams">;
export const TEST_TEAM_RED = "team-red" as Id<"teams">;

export const GENDER_BUCKET_CYCLE: readonly GenderBucket[] = ["m", "f", "other", "unknown"];

export const ROSTER_GENDER_CYCLE: ReadonlyArray<Doc<"studentRosters">["gender"] | undefined> = [
  "male",
  "female",
  "transMale",
  "transFemale",
  "nonBinary",
  "selfDescribe",
  "preferNotToSay",
  undefined,
];

export type OccupiedCell = {
  row: number;
  col: number;
  zoneName?: string;
  teamName?: string;
  deskNumber?: number;
};

export type ClassroomLayoutFixture = {
  name: string;
  rows: number;
  cols: number;
  items: Array<SeatLayoutItemSnapshot>;
  /** Independent 4-connectivity among occupied cells; ids sorted. */
  expectedNeighbors: Map<string, Array<string>>;
  deskIds: Array<string>;
};

export function deskItemId(row: number, col: number, cols: number): string {
  return `desk-${row * cols + col + 1}`;
}

export function deskItem(args: {
  id: string;
  x: number;
  y: number;
  deskNumber?: number;
  zoneName?: string;
  teamAssignment?: SeatLayoutItemSnapshot["teamAssignment"];
  kind?: SeatLayoutItemSnapshot["kind"];
  label?: string;
  width?: number;
  height?: number;
}): SeatLayoutItemSnapshot {
  return {
    id: args.id,
    kind: args.kind ?? "desk",
    label: args.label ?? "",
    x: args.x,
    y: args.y,
    width: args.width ?? DESK_SIZE,
    height: args.height ?? DESK_SIZE,
    ...(args.deskNumber !== undefined ? { deskNumber: args.deskNumber } : {}),
    ...(args.zoneName !== undefined ? { zoneName: args.zoneName } : {}),
    ...(args.teamAssignment !== undefined ? { teamAssignment: args.teamAssignment } : {}),
  };
}

function zoneForRow(row: number, rows: number): string {
  if (row < Math.max(1, Math.floor(rows / 3))) return "Front";
  if (row >= rows - Math.max(1, Math.floor(rows / 3))) return "Back";
  return "Middle";
}

function teamNameForCol(col: number): string {
  return col % 2 === 0 ? "Blue" : "Red";
}

/**
 * Independent grid adjacency: occupied cells are neighbors iff they share a
 * cardinal side (not a corner). This does not call production geometry code.
 */
export function expectedNeighborsFromCells(
  cells: ReadonlyArray<OccupiedCell>,
  cols: number,
): Map<string, Array<string>> {
  const occupied = new Map<string, OccupiedCell>();
  for (const cell of cells) {
    occupied.set(`${cell.row}:${cell.col}`, cell);
  }
  const neighbors = new Map<string, Array<string>>();
  const offsets = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ] as const;
  for (const cell of cells) {
    const id = deskItemId(cell.row, cell.col, cols);
    const adjacent: string[] = [];
    for (const [dRow, dCol] of offsets) {
      const key = `${cell.row + dRow}:${cell.col + dCol}`;
      const other = occupied.get(key);
      if (!other) continue;
      adjacent.push(deskItemId(other.row, other.col, cols));
    }
    neighbors.set(id, [...new Set(adjacent)].sort());
  }
  return neighbors;
}

export function layoutFromCells(args: {
  name: string;
  rows: number;
  cols: number;
  cells: ReadonlyArray<OccupiedCell>;
  numberDesks?: boolean;
  omitDeskNumbers?: ReadonlySet<number>;
}): ClassroomLayoutFixture {
  const numberDesks = args.numberDesks ?? true;
  const items: Array<SeatLayoutItemSnapshot> = args.cells.map((cell, index) => {
    const deskNumber = cell.deskNumber ?? index + 1;
    const omitNumber = args.omitDeskNumbers?.has(deskNumber) === true;
    return deskItem({
      id: deskItemId(cell.row, cell.col, args.cols),
      x: cell.col * DESK_SIZE,
      y: cell.row * DESK_SIZE,
      ...(numberDesks && !omitNumber ? { deskNumber } : {}),
      zoneName: cell.zoneName ?? zoneForRow(cell.row, args.rows),
      teamAssignment: {
        mode: "byName",
        teamName: cell.teamName ?? teamNameForCol(cell.col),
      },
    });
  });
  return {
    name: args.name,
    rows: args.rows,
    cols: args.cols,
    items,
    expectedNeighbors: expectedNeighborsFromCells(args.cells, args.cols),
    deskIds: items.filter((item) => item.kind === "desk").map((item) => item.id),
  };
}

export function gridCells(rows: number, cols: number): OccupiedCell[] {
  const cells: OccupiedCell[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      cells.push({ row, col });
    }
  }
  return cells;
}

export function gridLayout(
  rows: number,
  cols: number,
  options: { omitDeskNumbers?: ReadonlySet<number>; numberDesks?: boolean } = {},
): ClassroomLayoutFixture {
  return layoutFromCells({
    name: `grid${rows}x${cols}`,
    rows,
    cols,
    cells: gridCells(rows, cols),
    ...options,
  });
}

/** 4×5 classroom, 20 touching desks. */
export function grid4x5(): ClassroomLayoutFixture {
  return gridLayout(4, 5);
}

/** 5×6 classroom, 30 touching desks. */
export function grid5x6(): ClassroomLayoutFixture {
  return gridLayout(5, 6);
}

/**
 * Open-bottom U of 24 desks on a 9×8 occupancy grid:
 * top row of 8, left column of 8, right column of 8.
 */
export function uShape24(): ClassroomLayoutFixture {
  const cols = 8;
  const rows = 9;
  const cells: OccupiedCell[] = [];
  for (let col = 0; col < cols; col += 1) {
    cells.push({ row: 0, col, zoneName: "Front" });
  }
  for (let row = 1; row < rows; row += 1) {
    cells.push({ row, col: 0, zoneName: row >= 6 ? "Back" : "Middle", teamName: "Blue" });
    cells.push({
      row,
      col: cols - 1,
      zoneName: row >= 6 ? "Back" : "Middle",
      teamName: "Red",
    });
  }
  return layoutFromCells({ name: "uShape24", rows, cols, cells });
}

/** 20 desks, half without desk numbers — parity stress. */
export function parityStress20(): ClassroomLayoutFixture {
  const omit = new Set<number>();
  for (let number = 1; number <= 20; number += 1) {
    if (number % 2 === 0) omit.add(number);
  }
  return gridLayout(4, 5, { omitDeskNumbers: omit });
}

export function teacherDeskItem(): SeatLayoutItemSnapshot {
  return deskItem({
    id: "teacher-desk",
    kind: "teacherDesk",
    x: 200,
    y: -60,
    width: 80,
    height: 40,
    label: "Teacher",
  });
}

export function genderBucketForIndex(index: number): GenderBucket {
  return GENDER_BUCKET_CYCLE[index % GENDER_BUCKET_CYCLE.length]!;
}

export function rosterGenderForIndex(index: number): Doc<"studentRosters">["gender"] | undefined {
  return ROSTER_GENDER_CYCLE[index % ROSTER_GENDER_CYCLE.length];
}

export function classroomStudent(
  index: number,
  args: { groupId?: Id<"groups">; genderBucket?: GenderBucket } = {},
): SeatingStudent {
  return {
    studentUserId: `student-${index}` as Id<"users">,
    groupId: args.groupId ?? TEST_CLASSROOM_GROUP_ID,
    genderBucket: args.genderBucket ?? genderBucketForIndex(index),
  };
}

export function classroomStudents(
  count: number,
  args: { groupId?: Id<"groups">; dualGroup?: boolean } = {},
): SeatingStudent[] {
  return Array.from({ length: count }, (_, index) =>
    classroomStudent(index, {
      groupId: args.dualGroup
        ? index % 2 === 0
          ? TEST_CLASSROOM_GROUP_ID
          : TEST_CLASSROOM_GROUP_B_ID
        : args.groupId,
    }),
  );
}
