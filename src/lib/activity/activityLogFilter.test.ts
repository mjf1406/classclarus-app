import { describe, expect, test } from "vite-plus/test";

import { filterActivityIds, type FilterableActivityRow } from "./activityLogFilter";

const rows: FilterableActivityRow[] = [
  {
    id: "1",
    actorEmail: "alice@school.edu",
    actorRole: "teacher",
    action: "update",
    summary: "Updated class settings",
  },
  {
    id: "2",
    actorEmail: "bob@school.edu",
    actorRole: "student",
    action: "read",
    summary: "Viewed student member list",
  },
  {
    id: "3",
    actorEmail: "carol@school.edu",
    actorRole: "owner",
    action: "delete",
    summary: "Removed member (student)",
  },
];

describe("filterActivityIds", () => {
  test("returns all ids when no filters are set", () => {
    expect(
      filterActivityIds(rows, {
        emailQuery: "",
        summaryQuery: "",
        actions: [],
        roles: [],
      }),
    ).toEqual(["1", "2", "3"]);
  });

  test("filters by email, role, action, and summary", () => {
    expect(
      filterActivityIds(rows, {
        emailQuery: "bob",
        summaryQuery: "",
        actions: [],
        roles: [],
      }),
    ).toEqual(["2"]);

    expect(
      filterActivityIds(rows, {
        emailQuery: "",
        summaryQuery: "member",
        actions: ["delete"],
        roles: ["owner"],
      }),
    ).toEqual(["3"]);

    expect(
      filterActivityIds(rows, {
        emailQuery: "",
        summaryQuery: "",
        actions: ["read", "update"],
        roles: ["teacher", "student"],
      }),
    ).toEqual(["1", "2"]);
  });
});
