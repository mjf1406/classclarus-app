import { describe, expect, it } from "vite-plus/test";

import { findStrictDeskNeighborIds } from "../../../../convex/lib/seating/seatChartGeometry";
import { grid4x5, grid5x6, uShape24 } from "../../../../convex/lib/seating/classroomLayouts";
import { neighborMapFromIds } from "../../../../convex/lib/seating/seatingTestHelpers";
import { findStrictDeskNeighbors } from "../seatSnap";

function neighborSetFromEdges(items: Parameters<typeof findStrictDeskNeighborIds>[0]) {
  const map = new Map<string, string[]>();
  for (const edge of findStrictDeskNeighbors(items.map((item) => ({ ...item, kind: item.kind })))) {
    const list = map.get(edge.fromDeskId) ?? [];
    list.push(edge.toDeskId);
    map.set(edge.fromDeskId, list);
  }
  return neighborMapFromIds(map);
}

describe("strict desk neighbor parity", () => {
  it.each([grid4x5(), grid5x6(), uShape24()])("matches solver geometry for $name", (layout) => {
    const server = neighborMapFromIds(findStrictDeskNeighborIds(layout.items));
    const client = neighborSetFromEdges(layout.items);
    expect(client).toEqual(server);
    expect(server).toEqual(layout.expectedNeighbors);
  });
});
