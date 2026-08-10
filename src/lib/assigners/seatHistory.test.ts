import { describe, expect, test } from "vite-plus/test";

import {
  cloneSeatSnapshot,
  emptySeatHistory,
  pushSeatHistory,
  redoSeatHistory,
  seatSnapshotsEqual,
  undoSeatHistory,
} from "@/lib/assigners/seatHistory";
import type { SeatLayoutItem } from "@/lib/assigners/seatLayouts";

function desk(id: string, deskNumber: number, x = 0): SeatLayoutItem {
  return {
    id,
    kind: "desk",
    label: "",
    deskNumber,
    x,
    y: 0,
    width: 80,
    height: 60,
  };
}

function snap(
  items: Array<SeatLayoutItem>,
  nextDeskNumber: number,
  canvasWidth = 500,
  canvasHeight = 500,
) {
  return { items, nextDeskNumber, canvasWidth, canvasHeight };
}

describe("seatHistory", () => {
  test("cloneSeatSnapshot deep-copies items", () => {
    const snapshot = snap([desk("a", 1)], 2);
    const cloned = cloneSeatSnapshot(snapshot);
    cloned.items[0]!.x = 99;
    expect(snapshot.items[0]!.x).toBe(0);
  });

  test("equality includes canvas size", () => {
    const a = snap([desk("a", 1)], 2, 500, 500);
    const b = snap([desk("a", 1)], 2, 520, 500);
    expect(seatSnapshotsEqual(a, a)).toBe(true);
    expect(seatSnapshotsEqual(a, b)).toBe(false);
  });

  test("push / undo / redo round-trip", () => {
    const a = snap([desk("a", 1)], 2);
    const b = snap([desk("a", 1), desk("b", 2, 100)], 3, 520, 500);
    const c = snap([desk("a", 1), desk("b", 2, 100), desk("c", 3, 200)], 4, 520, 520);

    let history = emptySeatHistory();
    history = pushSeatHistory(history, a);
    history = pushSeatHistory(history, b);

    const undone = undoSeatHistory(history, c);
    expect(undone).not.toBeNull();
    expect(seatSnapshotsEqual(undone!.snapshot, b)).toBe(true);
    expect(undone!.history.past).toHaveLength(1);
    expect(undone!.history.future).toHaveLength(1);

    const redone = redoSeatHistory(undone!.history, undone!.snapshot);
    expect(redone).not.toBeNull();
    expect(seatSnapshotsEqual(redone!.snapshot, c)).toBe(true);
    expect(redone!.history.future).toHaveLength(0);
  });

  test("push clears future", () => {
    const a = snap([], 1);
    const b = snap([desk("a", 1)], 2);
    const c = snap([desk("a", 1), desk("b", 2)], 3);

    let history = pushSeatHistory(emptySeatHistory(), a);
    const undone = undoSeatHistory(history, b);
    expect(undone!.history.future).toHaveLength(1);
    history = pushSeatHistory(undone!.history, undone!.snapshot);
    expect(history.future).toHaveLength(0);
    expect(history.past).toHaveLength(1);
    void c;
  });

  test("undo returns null when empty", () => {
    expect(undoSeatHistory(emptySeatHistory(), snap([], 1))).toBeNull();
  });
});
