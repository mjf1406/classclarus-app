import { describe, expect, test } from "vite-plus/test";

import type { BoardGroup, BoardTeam, GroupsBoard } from "@/lib/groups/groups";
import { buildGroupsPrintHtml, buildGroupsPrintMatrix } from "@/lib/groups/groupsPrint";
import type { Id } from "../../../convex/_generated/dataModel";

function student(userId: string, name: string) {
  return { userId: userId as Id<"users">, name };
}

function team(partial: Pick<BoardTeam, "_id" | "groupId" | "name" | "students">): BoardTeam {
  return {
    ...partial,
    description: undefined,
    icon: undefined,
    imageFileId: undefined,
    updatedAt: 1,
  };
}

function group(partial: Pick<BoardGroup, "_id" | "name" | "students" | "teams">): BoardGroup {
  return {
    ...partial,
    description: undefined,
    icon: undefined,
    imageFileId: undefined,
    updatedAt: 1,
  };
}

function boardFixture(groups: GroupsBoard["groups"]): GroupsBoard {
  return { groups, ungrouped: [] };
}

const options = { teamlessLabel: "Teamless students" };

describe("buildGroupsPrintMatrix", () => {
  test("aligns teams by name across group columns and omits empty teams", () => {
    const matrix = buildGroupsPrintMatrix(
      boardFixture([
        group({
          _id: "g1" as Id<"groups">,
          name: "Period 1",
          students: [],
          teams: [
            team({
              _id: "t1" as Id<"teams">,
              groupId: "g1" as Id<"groups">,
              name: "Red",
              students: [student("u1", "Alice"), student("u2", "Bob")],
            }),
            team({
              _id: "t2" as Id<"teams">,
              groupId: "g1" as Id<"groups">,
              name: "Blue",
              students: [],
            }),
          ],
        }),
        group({
          _id: "g2" as Id<"groups">,
          name: "Period 2",
          students: [],
          teams: [
            team({
              _id: "t3" as Id<"teams">,
              groupId: "g2" as Id<"groups">,
              name: "red",
              students: [student("u3", "Carol")],
            }),
            team({
              _id: "t4" as Id<"teams">,
              groupId: "g2" as Id<"groups">,
              name: "Green",
              students: [student("u4", "Dave")],
            }),
          ],
        }),
      ]),
      options,
    );

    expect(matrix.groupNames).toEqual(["Period 1", "Period 2"]);
    expect(matrix.rows.map((row) => row.teamName)).toEqual(["Green", "Red"]);
    expect(matrix.rows[0]?.cells).toEqual([[], ["Dave"]]);
    expect(matrix.rows[1]?.cells).toEqual([["Alice", "Bob"], ["Carol"]]);
  });

  test("includes a teamless row and skips empty named teams", () => {
    const matrix = buildGroupsPrintMatrix(
      boardFixture([
        group({
          _id: "g1" as Id<"groups">,
          name: "Group A",
          students: [student("u1", "Marcus"), student("u2", "Mark Tristan")],
          teams: [
            team({
              _id: "t1" as Id<"teams">,
              groupId: "g1" as Id<"groups">,
              name: "Dragons",
              students: [],
            }),
          ],
        }),
        group({
          _id: "g2" as Id<"groups">,
          name: "Group B",
          students: [student("u3", "Tristan Geare")],
          teams: [
            team({
              _id: "t2" as Id<"teams">,
              groupId: "g2" as Id<"groups">,
              name: "Dragons",
              students: [],
            }),
          ],
        }),
      ]),
      options,
    );

    expect(matrix.rows).toHaveLength(1);
    expect(matrix.rows[0]?.teamName).toBe("Teamless students");
    expect(matrix.rows[0]?.cells).toEqual([["Marcus", "Mark Tristan"], ["Tristan Geare"]]);
  });

  test("returns no rows when groups have neither team nor teamless students", () => {
    const matrix = buildGroupsPrintMatrix(
      boardFixture([
        group({
          _id: "g1" as Id<"groups">,
          name: "Alone",
          students: [],
          teams: [
            team({
              _id: "t1" as Id<"teams">,
              groupId: "g1" as Id<"groups">,
              name: "Empty",
              students: [],
            }),
          ],
        }),
      ]),
      options,
    );
    expect(matrix.rows).toEqual([]);
  });
});

describe("buildGroupsPrintHtml", () => {
  test("embeds the brand logo and escaped student names", () => {
    const html = buildGroupsPrintHtml(
      {
        groupNames: ["A"],
        rows: [{ teamName: "Red", cells: [["Alice <B>"]] }],
      },
      {
        documentTitle: "Doc",
        heading: "Heading",
        subtitle: "Sub",
        teamColumnLabel: "Team",
        logoAlt: "ClassClarus Logo",
      },
      "https://example.test/brand/logo/icon-and-text-horizontal.webp",
    );

    expect(html).toContain("icon-and-text-horizontal.webp");
    expect(html).toContain("Alice &lt;B&gt;");
    expect(html).not.toContain("Alice <B>");
  });
});
