import { describe, expect, test } from "vite-plus/test";

import { buildRandomAssignerDataRows } from "@/lib/assigners/randomAssignerData";

describe("buildRandomAssignerDataRows", () => {
  test("filters zero counts and sorts by quantity desc then label", () => {
    const rows = buildRandomAssignerDataRows(
      ["Alpha", "Bravo", "Charlie"],
      new Map([
        ["Alpha", 1],
        ["Bravo", 3],
        ["Charlie", 0],
      ]),
    );

    expect(rows).toEqual([
      { item: "Bravo", count: 3 },
      { item: "Alpha", count: 1 },
    ]);
  });

  test("breaks ties by label", () => {
    const rows = buildRandomAssignerDataRows(
      ["Bravo", "Alpha"],
      new Map([
        ["Alpha", 2],
        ["Bravo", 2],
      ]),
    );

    expect(rows).toEqual([
      { item: "Alpha", count: 2 },
      { item: "Bravo", count: 2 },
    ]);
  });
});
