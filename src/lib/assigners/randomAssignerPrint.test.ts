import { describe, expect, it } from "vite-plus/test";

import type { RandomAssignerRunDetail } from "@/lib/assigners/randomAssigners";
import {
  buildRandomAssignerPrintHtml,
  buildRandomAssignerPrintMatrix,
  formatRandomAssignerPrintStudent,
} from "@/lib/assigners/randomAssignerPrint";
import type { Id } from "../../../convex/_generated/dataModel";

describe("formatRandomAssignerPrintStudent", () => {
  it("formats roster number and name with class name settings", () => {
    expect(
      formatRandomAssignerPrintStudent(
        {
          studentDisplayName: "Alex Kim",
          firstName: "Alex",
          lastName: "Kim",
          rosterNumber: 3,
        },
        { order: "firstLast", space: true },
      ),
    ).toBe("#3 - Alex Kim");

    expect(
      formatRandomAssignerPrintStudent(
        {
          studentDisplayName: "KimAlex",
          firstName: "Alex",
          lastName: "Kim",
          rosterNumber: 3,
        },
        { order: "lastFirst", space: false },
      ),
    ).toBe("#3 - KimAlex");

    expect(
      formatRandomAssignerPrintStudent(
        { studentDisplayName: "Alex", rosterNumber: 3 },
        { order: "firstLast", space: true },
      ),
    ).toBe("#3 - Alex");
  });
});

describe("buildRandomAssignerPrintMatrix", () => {
  it("puts items in rows and groups in columns", () => {
    const run: RandomAssignerRunDetail = {
      _id: "run1" as Id<"randomAssignerRuns">,
      _creationTime: 0,
      classId: "class1" as Id<"classes">,
      assignerId: "assigner1" as Id<"randomAssigners">,
      assignerName: "Chromebooks",
      ranAt: Date.UTC(2026, 0, 15, 12, 0),
      ranBy: "user1" as Id<"users">,
      scope: "groups",
      replicates: false,
      itemsSnapshot: ["CB-1", "CB-2"],
      assignments: [
        {
          studentUserId: "s1" as Id<"users">,
          studentDisplayName: "Alex",
          firstName: "Alex",
          lastName: "Kim",
          rosterNumber: 3,
          item: "CB-1",
          groupId: "g1" as Id<"groups">,
          groupName: "Red",
        },
        {
          studentUserId: "s2" as Id<"users">,
          studentDisplayName: "Blake",
          firstName: "Blake",
          lastName: "Lee",
          rosterNumber: 1,
          item: "CB-2",
          groupId: "g2" as Id<"groups">,
          groupName: "Blue",
        },
        {
          studentUserId: "s3" as Id<"users">,
          studentDisplayName: "Casey",
          firstName: "Casey",
          lastName: "Ng",
          rosterNumber: 2,
          item: "CB-1",
          groupId: "g2" as Id<"groups">,
          groupName: "Blue",
        },
      ],
    };

    const matrix = buildRandomAssignerPrintMatrix(run, {
      classColumn: "Whole class",
      ungroupedColumn: "Ungrouped",
      nameFormat: { order: "firstLast", space: true },
    });

    expect(matrix.groupNames).toEqual(["Blue", "Red"]);
    expect(matrix.rows).toEqual([
      {
        item: "CB-1",
        cells: [["#2 - Casey Ng"], ["#3 - Alex Kim"]],
      },
      {
        item: "CB-2",
        cells: [["#1 - Blake Lee"], []],
      },
    ]);
  });

  it("uses a class column when no groups are present", () => {
    const run: RandomAssignerRunDetail = {
      _id: "run1" as Id<"randomAssignerRuns">,
      _creationTime: 0,
      classId: "class1" as Id<"classes">,
      assignerId: "assigner1" as Id<"randomAssigners">,
      assignerName: "Chromebooks",
      ranAt: Date.UTC(2026, 0, 15, 12, 0),
      ranBy: "user1" as Id<"users">,
      scope: "class",
      replicates: false,
      itemsSnapshot: ["CB-1"],
      assignments: [
        {
          studentUserId: "s1" as Id<"users">,
          studentDisplayName: "Alex",
          firstName: "Alex",
          lastName: "Kim",
          rosterNumber: 3,
          item: "CB-1",
        },
      ],
    };

    const matrix = buildRandomAssignerPrintMatrix(run, {
      classColumn: "Whole class",
      ungroupedColumn: "Ungrouped",
      nameFormat: { order: "lastFirst", space: false },
    });
    expect(matrix.groupNames).toEqual(["Whole class"]);
    expect(matrix.rows[0]?.cells).toEqual([["#3 - KimAlex"]]);
  });
});

describe("buildRandomAssignerPrintHtml", () => {
  it("includes branding and matrix cells", () => {
    const run: RandomAssignerRunDetail = {
      _id: "run1" as Id<"randomAssignerRuns">,
      _creationTime: 0,
      classId: "class1" as Id<"classes">,
      assignerId: "assigner1" as Id<"randomAssigners">,
      assignerName: "Chromebooks",
      ranAt: Date.UTC(2026, 0, 15, 12, 0),
      ranBy: "user1" as Id<"users">,
      scope: "class",
      replicates: false,
      itemsSnapshot: ["CB-1"],
      assignments: [
        {
          studentUserId: "s1" as Id<"users">,
          studentDisplayName: "Alex",
          firstName: "Alex",
          lastName: "Kim",
          rosterNumber: 3,
          item: "CB-1",
        },
      ],
    };

    const html = buildRandomAssignerPrintHtml(
      run,
      {
        documentTitle: "Test",
        heading: "Chromebooks",
        subtitle: "1 assignments",
        itemColumn: "Item",
        classColumn: "Whole class",
        ungroupedColumn: "Ungrouped",
        logoAlt: "ClassClarus Logo",
      },
      "https://example.com/logo.webp",
      { order: "firstLast", space: true },
    );
    expect(html).toContain("logo.webp");
    expect(html).toContain("Chromebooks");
    expect(html).toContain("CB-1");
    expect(html).toContain("#3 - Alex Kim");
    expect(html).toContain("Whole class");
  });
});
