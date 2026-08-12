import { describe, expect, it } from "vite-plus/test";

import type { Id } from "../../_generated/dataModel";
import { seatAggregateKey } from "../seatChartLogic";
import {
  buildSeatLayoutRosterMatrixCounts,
  layoutValuesForSeat,
  layoutValuesForZone,
  mergeMatrixValues,
  valuesFromAggregateLabels,
} from "./layoutRosterMatrix";

const layoutId = "layout1" as Id<"seatLayouts">;
const studentA = "studentA" as Id<"users">;
const studentB = "studentB" as Id<"users">;

const layout = {
  _id: layoutId,
  items: [
    {
      id: "desk-1",
      kind: "desk" as const,
      label: "",
      deskNumber: 2,
      zoneName: "Back",
      x: 0,
      y: 0,
      width: 40,
      height: 40,
    },
    {
      id: "desk-2",
      kind: "desk" as const,
      label: "",
      deskNumber: 1,
      zoneName: "Front",
      x: 40,
      y: 0,
      width: 40,
      height: 40,
    },
  ],
};

describe("layoutRosterMatrix", () => {
  it("orders seat values by desk number", () => {
    expect(layoutValuesForSeat(layout)).toEqual([
      { key: seatAggregateKey(layoutId, "desk-2"), label: "Seat 1" },
      { key: seatAggregateKey(layoutId, "desk-1"), label: "Seat 2" },
    ]);
  });

  it("orders zone values alphabetically", () => {
    expect(layoutValuesForZone(layout)).toEqual([
      { key: "Back", label: "Back" },
      { key: "Front", label: "Front" },
    ]);
  });

  it("keeps layout values first and appends stale aggregate keys", () => {
    const merged = mergeMatrixValues(layoutValuesForSeat(layout), [
      { key: seatAggregateKey(layoutId, "removed-desk"), label: "Seat 9" },
    ]);
    expect(merged).toEqual([
      { key: seatAggregateKey(layoutId, "desk-2"), label: "Seat 1" },
      { key: seatAggregateKey(layoutId, "desk-1"), label: "Seat 2" },
      { key: seatAggregateKey(layoutId, "removed-desk"), label: "Seat 9" },
    ]);
  });

  it("uses aggregate key when label is missing", () => {
    expect(valuesFromAggregateLabels([{ key: "neighbor-1", label: "" }])).toEqual([
      { key: "neighbor-1", label: "neighbor-1" },
    ]);
  });

  it("builds zero-filled counts for every student and value", () => {
    const values = layoutValuesForSeat(layout);
    const counts = buildSeatLayoutRosterMatrixCounts(
      values,
      [studentA, studentB],
      [{ studentUserId: studentA, key: values[0]!.key, count: 2 }],
    );
    expect(counts).toEqual([
      {
        studentUserId: studentA,
        counts: [
          { key: values[0]!.key, count: 2 },
          { key: values[1]!.key, count: 0 },
        ],
      },
      {
        studentUserId: studentB,
        counts: [
          { key: values[0]!.key, count: 0 },
          { key: values[1]!.key, count: 0 },
        ],
      },
    ]);
  });
});
