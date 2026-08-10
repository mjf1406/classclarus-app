export type SeatSnapRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SeatSnapGuide = {
  orientation: "vertical" | "horizontal";
  /** Position in canvas coordinates (x for vertical, y for horizontal). */
  position: number;
};

export type SeatSnapResult = {
  x: number;
  y: number;
  width: number;
  height: number;
  guides: Array<SeatSnapGuide>;
};

export type SeatNeighborDirection = "north" | "east" | "south" | "west";

export type SeatNeighborEdge = {
  fromDeskId: string;
  toDeskId: string;
  direction: SeatNeighborDirection;
};

export const DEFAULT_SNAP_THRESHOLD_PX = 8;
export const DEFAULT_NEIGHBOR_GAP_PX = 12;
export const DEFAULT_NEIGHBOR_OVERLAP_RATIO = 0.25;
export const MIN_ITEM_SIZE_PX = 24;

export function snapToGridValue(value: number, gridSize: number): number {
  if (gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Hard-snap a moving/resizing rect to a regular grid.
 * Pass `resizeEdge` when resizing; omit for drag (position only).
 */
export function snapRectToGrid(
  moving: SeatSnapRect,
  options: {
    gridSize: number;
    /** When set, only that edge moves; opposite edge stays fixed. */
    resizeEdge?: "n" | "e" | "s" | "w";
    enabled?: boolean;
  },
): SeatSnapResult {
  if (options.enabled === false || options.gridSize <= 0) {
    return {
      x: moving.x,
      y: moving.y,
      width: moving.width,
      height: moving.height,
      guides: [],
    };
  }

  const grid = options.gridSize;
  const resizeEdge = options.resizeEdge;
  let { x, y, width, height } = moving;

  if (!resizeEdge) {
    return {
      x: snapToGridValue(x, grid),
      y: snapToGridValue(y, grid),
      width,
      height,
      guides: [],
    };
  }

  if (resizeEdge === "e") {
    const right = snapToGridValue(x + width, grid);
    width = Math.max(MIN_ITEM_SIZE_PX, right - x);
  } else if (resizeEdge === "w") {
    const right = x + width;
    const nextX = snapToGridValue(x, grid);
    const nextWidth = right - nextX;
    if (nextWidth >= MIN_ITEM_SIZE_PX) {
      x = nextX;
      width = nextWidth;
    }
  } else if (resizeEdge === "s") {
    const bottom = snapToGridValue(y + height, grid);
    height = Math.max(MIN_ITEM_SIZE_PX, bottom - y);
  } else if (resizeEdge === "n") {
    const bottom = y + height;
    const nextY = snapToGridValue(y, grid);
    const nextHeight = bottom - nextY;
    if (nextHeight >= MIN_ITEM_SIZE_PX) {
      y = nextY;
      height = nextHeight;
    }
  }

  return { x, y, width, height, guides: [] };
}

type AxisCandidate = {
  delta: number;
  guide: number;
};

function closestCandidate(
  candidates: Array<AxisCandidate>,
  threshold: number,
): AxisCandidate | null {
  let best: AxisCandidate | null = null;
  for (const candidate of candidates) {
    const abs = Math.abs(candidate.delta);
    if (abs > threshold) continue;
    if (!best || abs < Math.abs(best.delta)) {
      best = candidate;
    }
  }
  return best;
}

/**
 * Snap a moving/resizing rect to other items' edges/centers and canvas bounds.
 * Pass `resizeEdge` when resizing; omit for drag (position only).
 */
export function snapRect(
  moving: SeatSnapRect,
  others: Array<SeatSnapRect>,
  options: {
    canvasWidth: number;
    canvasHeight: number;
    threshold?: number;
    /** When set, only that edge moves; opposite edge stays fixed. */
    resizeEdge?: "n" | "e" | "s" | "w";
    enabled?: boolean;
  },
): SeatSnapResult {
  const threshold = options.threshold ?? DEFAULT_SNAP_THRESHOLD_PX;
  if (options.enabled === false) {
    return {
      x: moving.x,
      y: moving.y,
      width: moving.width,
      height: moving.height,
      guides: [],
    };
  }

  const targetsX: Array<number> = [0, options.canvasWidth / 2, options.canvasWidth];
  const targetsY: Array<number> = [0, options.canvasHeight / 2, options.canvasHeight];
  for (const other of others) {
    if (other.id === moving.id) continue;
    targetsX.push(other.x, other.x + other.width / 2, other.x + other.width);
    targetsY.push(other.y, other.y + other.height / 2, other.y + other.height);
  }

  let { x, y, width, height } = moving;
  const guides: Array<SeatSnapGuide> = [];
  const resizeEdge = options.resizeEdge;

  if (!resizeEdge || resizeEdge === "w" || resizeEdge === "e") {
    const left = x;
    const centerX = x + width / 2;
    const right = x + width;
    const xCandidates: Array<AxisCandidate> = [];
    for (const target of targetsX) {
      xCandidates.push({ delta: target - left, guide: target });
      xCandidates.push({ delta: target - centerX, guide: target });
      xCandidates.push({ delta: target - right, guide: target });
    }
    const bestX = closestCandidate(xCandidates, threshold);
    if (bestX) {
      if (resizeEdge === "w") {
        const newX = x + bestX.delta;
        const newWidth = width - bestX.delta;
        if (newWidth >= MIN_ITEM_SIZE_PX) {
          x = newX;
          width = newWidth;
          guides.push({ orientation: "vertical", position: bestX.guide });
        }
      } else if (resizeEdge === "e") {
        const newWidth = width + bestX.delta;
        if (newWidth >= MIN_ITEM_SIZE_PX) {
          width = newWidth;
          guides.push({ orientation: "vertical", position: bestX.guide });
        }
      } else {
        x += bestX.delta;
        guides.push({ orientation: "vertical", position: bestX.guide });
      }
    }
  }

  if (!resizeEdge || resizeEdge === "n" || resizeEdge === "s") {
    const top = y;
    const centerY = y + height / 2;
    const bottom = y + height;
    const yCandidates: Array<AxisCandidate> = [];
    for (const target of targetsY) {
      yCandidates.push({ delta: target - top, guide: target });
      yCandidates.push({ delta: target - centerY, guide: target });
      yCandidates.push({ delta: target - bottom, guide: target });
    }
    const bestY = closestCandidate(yCandidates, threshold);
    if (bestY) {
      if (resizeEdge === "n") {
        const newY = y + bestY.delta;
        const newHeight = height - bestY.delta;
        if (newHeight >= MIN_ITEM_SIZE_PX) {
          y = newY;
          height = newHeight;
          guides.push({ orientation: "horizontal", position: bestY.guide });
        }
      } else if (resizeEdge === "s") {
        const newHeight = height + bestY.delta;
        if (newHeight >= MIN_ITEM_SIZE_PX) {
          height = newHeight;
          guides.push({ orientation: "horizontal", position: bestY.guide });
        }
      } else {
        y += bestY.delta;
        guides.push({ orientation: "horizontal", position: bestY.guide });
      }
    }
  }

  return { x, y, width, height, guides };
}

type DeskLike = SeatSnapRect & { kind: string };

/**
 * Compute N/E/S/W desk adjacency from AABB proximity (for later seat-neighbor features).
 */
export function findDeskNeighbors(
  items: Array<DeskLike>,
  options?: {
    gapTolerance?: number;
    overlapRatio?: number;
  },
): Array<SeatNeighborEdge> {
  const gap = options?.gapTolerance ?? DEFAULT_NEIGHBOR_GAP_PX;
  const overlapRatio = options?.overlapRatio ?? DEFAULT_NEIGHBOR_OVERLAP_RATIO;
  const desks = items.filter((item) => item.kind === "desk");
  const edges: Array<SeatNeighborEdge> = [];

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
      const minOverlapX = Math.min(a.width, b.width) * overlapRatio;
      const minOverlapY = Math.min(a.height, b.height) * overlapRatio;

      // b east of a
      const gapEast = b.x - aRight;
      if (gapEast >= -1 && gapEast <= gap && overlapY >= minOverlapY) {
        edges.push({ fromDeskId: a.id, toDeskId: b.id, direction: "east" });
        edges.push({ fromDeskId: b.id, toDeskId: a.id, direction: "west" });
        continue;
      }
      // b west of a
      const gapWest = a.x - bRight;
      if (gapWest >= -1 && gapWest <= gap && overlapY >= minOverlapY) {
        edges.push({ fromDeskId: a.id, toDeskId: b.id, direction: "west" });
        edges.push({ fromDeskId: b.id, toDeskId: a.id, direction: "east" });
        continue;
      }
      // b south of a
      const gapSouth = b.y - aBottom;
      if (gapSouth >= -1 && gapSouth <= gap && overlapX >= minOverlapX) {
        edges.push({ fromDeskId: a.id, toDeskId: b.id, direction: "south" });
        edges.push({ fromDeskId: b.id, toDeskId: a.id, direction: "north" });
        continue;
      }
      // b north of a
      const gapNorth = a.y - bBottom;
      if (gapNorth >= -1 && gapNorth <= gap && overlapX >= minOverlapX) {
        edges.push({ fromDeskId: a.id, toDeskId: b.id, direction: "north" });
        edges.push({ fromDeskId: b.id, toDeskId: a.id, direction: "south" });
      }
    }
  }

  return edges;
}
