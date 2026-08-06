import { describe, expect, test } from "vite-plus/test";

import {
  filterClassIds,
  normalizeSearchText,
  type SearchableClass,
} from "@/lib/classes/classSearch";

const classes: SearchableClass[] = [
  {
    id: "1",
    name: "Biology",
    year: 2026,
    description: "Cell structure and genetics",
  },
  {
    id: "2",
    name: "Café Art",
    year: 2025,
    description: "Painting and drawing",
  },
  {
    id: "3",
    name: "History",
    year: 2024,
  },
];

describe("normalizeSearchText", () => {
  test("trims, lowercases, and strips diacritics", () => {
    expect(normalizeSearchText("  Café  ")).toBe("cafe");
  });
});

describe("filterClassIds", () => {
  test("returns all ids for empty or whitespace queries", () => {
    expect(filterClassIds(classes, "")).toEqual(["1", "2", "3"]);
    expect(filterClassIds(classes, "   ")).toEqual(["1", "2", "3"]);
  });

  test("matches name case-insensitively", () => {
    expect(filterClassIds(classes, "bio")).toEqual(["1"]);
    expect(filterClassIds(classes, "HISTORY")).toEqual(["3"]);
  });

  test("matches year as substring", () => {
    expect(filterClassIds(classes, "202")).toEqual(["1", "2", "3"]);
    expect(filterClassIds(classes, "2025")).toEqual(["2"]);
  });

  test("matches description", () => {
    expect(filterClassIds(classes, "genetics")).toEqual(["1"]);
    expect(filterClassIds(classes, "painting")).toEqual(["2"]);
  });

  test("matches normalized diacritics in name", () => {
    expect(filterClassIds(classes, "cafe")).toEqual(["2"]);
  });

  test("returns empty array when nothing matches", () => {
    expect(filterClassIds(classes, "zzzz")).toEqual([]);
  });
});
