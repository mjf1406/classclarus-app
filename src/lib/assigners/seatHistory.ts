import type { SeatLayoutItem } from "@/lib/assigners/seatLayouts";

export type SeatEditorSnapshot = {
  items: Array<SeatLayoutItem>;
  nextDeskNumber: number;
  canvasWidth: number;
  canvasHeight: number;
};

export type SeatEditorHistory = {
  past: Array<SeatEditorSnapshot>;
  future: Array<SeatEditorSnapshot>;
};

export const SEAT_EDITOR_HISTORY_LIMIT = 50;

export function emptySeatHistory(): SeatEditorHistory {
  return { past: [], future: [] };
}

export function cloneSeatSnapshot(snapshot: SeatEditorSnapshot): SeatEditorSnapshot {
  return {
    items: snapshot.items.map((item) => ({
      ...item,
      teamAssignment: item.teamAssignment,
    })),
    nextDeskNumber: snapshot.nextDeskNumber,
    canvasWidth: snapshot.canvasWidth,
    canvasHeight: snapshot.canvasHeight,
  };
}

export function seatSnapshotsEqual(a: SeatEditorSnapshot, b: SeatEditorSnapshot): boolean {
  if (a.nextDeskNumber !== b.nextDeskNumber) return false;
  if (a.canvasWidth !== b.canvasWidth) return false;
  if (a.canvasHeight !== b.canvasHeight) return false;
  if (a.items.length !== b.items.length) return false;
  return JSON.stringify(a.items) === JSON.stringify(b.items);
}

/** Push `current` onto past and clear redo. */
export function pushSeatHistory(
  history: SeatEditorHistory,
  current: SeatEditorSnapshot,
  limit = SEAT_EDITOR_HISTORY_LIMIT,
): SeatEditorHistory {
  const past = [...history.past, cloneSeatSnapshot(current)];
  if (past.length > limit) {
    past.splice(0, past.length - limit);
  }
  return { past, future: [] };
}

export function undoSeatHistory(
  history: SeatEditorHistory,
  current: SeatEditorSnapshot,
): { history: SeatEditorHistory; snapshot: SeatEditorSnapshot } | null {
  const previous = history.past[history.past.length - 1];
  if (!previous) return null;
  return {
    snapshot: cloneSeatSnapshot(previous),
    history: {
      past: history.past.slice(0, -1),
      future: [cloneSeatSnapshot(current), ...history.future],
    },
  };
}

export function redoSeatHistory(
  history: SeatEditorHistory,
  current: SeatEditorSnapshot,
): { history: SeatEditorHistory; snapshot: SeatEditorSnapshot } | null {
  const next = history.future[0];
  if (!next) return null;
  return {
    snapshot: cloneSeatSnapshot(next),
    history: {
      past: [...history.past, cloneSeatSnapshot(current)],
      future: history.future.slice(1),
    },
  };
}
