import { describe, expect, test } from "vite-plus/test";

import type { Id } from "../../../../convex/_generated/dataModel";
import {
  buildSeatDeskMetadataMap,
  buildSeatHistoryRows,
  formatSeatDeskDetail,
} from "./seatHistoryRows";

describe("buildSeatHistoryRows", () => {
  const values = [
    { key: "a", label: "Alpha" },
    { key: "b", label: "Bravo" },
    { key: "c", label: "Charlie" },
  ];

  test("filters zero counts and sorts by quantity desc then label", () => {
    const rows = buildSeatHistoryRows(values, [
      { key: "a", count: 1 },
      { key: "b", count: 3 },
      { key: "c", count: 0 },
    ]);

    expect(rows).toEqual([
      { key: "b", label: "Bravo", count: 3 },
      { key: "a", label: "Alpha", count: 1 },
    ]);
  });

  test("breaks ties by label", () => {
    const rows = buildSeatHistoryRows(values, [
      { key: "a", count: 2 },
      { key: "b", count: 2 },
    ]);

    expect(rows).toEqual([
      { key: "a", label: "Alpha", count: 2 },
      { key: "b", label: "Bravo", count: 2 },
    ]);
  });

  test("accepts a count map", () => {
    const rows = buildSeatHistoryRows(values, new Map([["b", 4]]));

    expect(rows).toEqual([{ key: "b", label: "Bravo", count: 4 }]);
  });

  test("returns empty when no nonzero counts", () => {
    expect(buildSeatHistoryRows(values, [])).toEqual([]);
    expect(buildSeatHistoryRows(values, undefined)).toEqual([]);
  });

  test("attaches seat zone and team detail when metadata is provided", () => {
    const metadata = new Map([
      ["a", { zoneName: "Front", teamLabel: "Red" }],
      ["b", { zoneName: "Back" }],
    ]);

    const rows = buildSeatHistoryRows(
      values,
      [
        { key: "a", count: 2 },
        { key: "b", count: 1 },
      ],
      metadata,
    );

    expect(rows).toEqual([
      { key: "a", label: "Alpha", detail: "Front · Red", count: 2 },
      { key: "b", label: "Bravo", detail: "Back", count: 1 },
    ]);
  });
});

describe("formatSeatDeskDetail", () => {
  test("joins zone and team with a middle dot", () => {
    expect(formatSeatDeskDetail({ zoneName: "Front", teamLabel: "Red" })).toBe("Front · Red");
    expect(formatSeatDeskDetail({ zoneName: "Front" })).toBe("Front");
    expect(formatSeatDeskDetail({ teamLabel: "Red" })).toBe("Red");
    expect(formatSeatDeskDetail({})).toBeUndefined();
  });
});

describe("buildSeatDeskMetadataMap", () => {
  const layoutId = "layout-1" as Id<"seatLayouts">;
  const groupId = "group-1" as Id<"groups">;
  const teamId = "team-1" as Id<"teams">;

  test("maps desk keys to zone and team labels", () => {
    const map = buildSeatDeskMetadataMap(
      layoutId,
      [
        {
          id: "desk-1",
          kind: "desk",
          label: "Desk",
          zoneName: " Window ",
          teamAssignment: { mode: "byName", teamName: "Red" },
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
      ],
      [{ _id: groupId, name: "Group A", teams: [{ _id: teamId, name: "Red" }] }],
    );

    expect(map.get(`${layoutId}:desk-1`)).toEqual({
      zoneName: "Window",
      teamLabel: "Red",
    });
  });
});
