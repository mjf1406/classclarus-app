import { describe, expect, test } from "vite-plus/test";

import {
  filterPointsCatalogIds,
  normalizeSearchText,
  type SearchablePointsCatalogItem,
} from "@/lib/points/pointsCatalogSearch";

const items: SearchablePointsCatalogItem[] = [
  {
    id: "1",
    name: "On task",
    description: "Working quietly",
  },
  {
    id: "2",
    name: "Café helper",
    description: "Helps with cleanup",
  },
  {
    id: "3",
    name: "Sticker",
  },
];

describe("normalizeSearchText", () => {
  test("trims, lowercases, and strips diacritics", () => {
    expect(normalizeSearchText("  Café  ")).toBe("cafe");
  });
});

describe("filterPointsCatalogIds", () => {
  test("returns all ids for empty or whitespace queries", () => {
    expect(filterPointsCatalogIds(items, "")).toEqual(["1", "2", "3"]);
    expect(filterPointsCatalogIds(items, "   ")).toEqual(["1", "2", "3"]);
  });

  test("matches name case-insensitively", () => {
    expect(filterPointsCatalogIds(items, "on task")).toEqual(["1"]);
    expect(filterPointsCatalogIds(items, "STICKER")).toEqual(["3"]);
  });

  test("matches description", () => {
    expect(filterPointsCatalogIds(items, "quietly")).toEqual(["1"]);
    expect(filterPointsCatalogIds(items, "cleanup")).toEqual(["2"]);
  });

  test("matches normalized diacritics in name", () => {
    expect(filterPointsCatalogIds(items, "cafe")).toEqual(["2"]);
  });

  test("returns empty array when nothing matches", () => {
    expect(filterPointsCatalogIds(items, "zzzz")).toEqual([]);
  });
});
