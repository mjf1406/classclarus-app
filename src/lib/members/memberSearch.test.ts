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

  test("matches firstName and lastName roster fields", () => {
    const withRoster: SearchableMember[] = [
      {
        id: "4",
        name: "Display Only",
        firstName: "Kai",
        lastName: "Nguyen",
        email: "kai@school.edu",
      },
    ];
    expect(filterMemberIds(withRoster, "kai")).toEqual(["4"]);
    expect(filterMemberIds(withRoster, "nguyen")).toEqual(["4"]);
  });

  test("matches full name across firstName and lastName columns", () => {
    const withRoster: SearchableMember[] = [
      {
        id: "5",
        name: "Account Name",
        firstName: "Ada",
        lastName: "Lovelace",
      },
    ];
    expect(filterMemberIds(withRoster, "Ada Lovelace")).toEqual(["5"]);
    expect(filterMemberIds(withRoster, "lovelace ada")).toEqual(["5"]);
    expect(filterMemberIds(withRoster, "adalovelace")).toEqual(["5"]);
  });

  test("matches account name even when roster first/last differ", () => {
    const withRoster: SearchableMember[] = [
      {
        id: "6",
        name: "A. Lovelace",
        firstName: "Ada",
        lastName: "King",
      },
    ];
    expect(filterMemberIds(withRoster, "A. Lovelace")).toEqual(["6"]);
    expect(filterMemberIds(withRoster, "king")).toEqual(["6"]);
  });
});
