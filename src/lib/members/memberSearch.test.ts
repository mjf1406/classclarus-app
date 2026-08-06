import { describe, expect, test } from "vite-plus/test";

import {
  filterMemberIds,
  normalizeSearchText,
  type SearchableMember,
} from "@/lib/members/memberSearch";

const members: SearchableMember[] = [
  {
    id: "1",
    name: "Alice Smith",
    email: "alice@school.edu",
  },
  {
    id: "2",
    name: "José García",
    email: "jose@school.edu",
  },
  {
    id: "3",
    email: "noname@school.edu",
  },
];

describe("normalizeSearchText", () => {
  test("trims, lowercases, and strips diacritics", () => {
    expect(normalizeSearchText("  José  ")).toBe("jose");
  });
});

describe("filterMemberIds", () => {
  test("returns all ids for empty or whitespace queries", () => {
    expect(filterMemberIds(members, "")).toEqual(["1", "2", "3"]);
    expect(filterMemberIds(members, "   ")).toEqual(["1", "2", "3"]);
  });

  test("matches name case-insensitively", () => {
    expect(filterMemberIds(members, "alice")).toEqual(["1"]);
    expect(filterMemberIds(members, "SMITH")).toEqual(["1"]);
  });

  test("matches email", () => {
    expect(filterMemberIds(members, "jose@school")).toEqual(["2"]);
    expect(filterMemberIds(members, "noname")).toEqual(["3"]);
  });

  test("matches normalized diacritics in name", () => {
    expect(filterMemberIds(members, "jose")).toEqual(["2"]);
    expect(filterMemberIds(members, "garcia")).toEqual(["2"]);
  });

  test("returns empty array when nothing matches", () => {
    expect(filterMemberIds(members, "zzzz")).toEqual([]);
  });
});
