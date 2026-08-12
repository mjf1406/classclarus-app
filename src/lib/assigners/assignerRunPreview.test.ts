import { describe, expect, it } from "vite-plus/test";

import type { Id } from "../../../convex/_generated/dataModel";
import type { StudentRosterEntry } from "@/lib/roster/roster";
import {
  buildAssignerPreviewRows,
  filterAssignerPreviewRows,
  isAssignerPreviewRosterRow,
  type AssignerPreviewAssignment,
} from "./assignerRunPreview";

function assignment(
  overrides: Partial<AssignerPreviewAssignment> & Pick<AssignerPreviewAssignment, "studentUserId">,
): AssignerPreviewAssignment {
  return {
    studentDisplayName: "Ada Lovelace",
    item: "Chromebook 1",
    rosterNumber: 3,
    firstName: "Ada",
    lastName: "Lovelace",
    ...overrides,
  };
}

function rosterEntry(
  overrides: Partial<StudentRosterEntry> & Pick<StudentRosterEntry, "userId">,
): StudentRosterEntry {
  return {
    rosterNumber: 7,
    firstName: "Ada",
    lastName: "Lovelace",
    name: "Ada L.",
    email: "ada@school.test",
    role: "student",
    ...overrides,
  };
}

describe("buildAssignerPreviewRows", () => {
  it("uses live roster fields when the student is still enrolled", () => {
    const userId = "user1" as Id<"users">;
    const rows = buildAssignerPreviewRows(
      [assignment({ studentUserId: userId, item: "Tablet" })],
      [rosterEntry({ userId, firstName: "Ada", lastName: "Byron" })],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.firstName).toBe("Ada");
    expect(rows[0]?.lastName).toBe("Byron");
    expect(rows[0]?.email).toBe("ada@school.test");
    expect(rows[0]?.assignedItem).toBe("Tablet");
    expect(rows[0]?.assignmentIndex).toBe(0);
  });

  it("falls back to the assignment snapshot when the student left the class", () => {
    const userId = "user2" as Id<"users">;
    const rows = buildAssignerPreviewRows(
      [
        assignment({
          studentUserId: userId,
          studentDisplayName: "Grace Hopper",
          firstName: "Grace",
          lastName: "Hopper",
          rosterNumber: 12,
          groupName: "Table 2",
        }),
      ],
      [],
    );

    expect(rows[0]).toMatchObject({
      userId,
      firstName: "Grace",
      lastName: "Hopper",
      name: "Grace Hopper",
      rosterNumber: 12,
      assignedItem: "Chromebook 1",
      assignedGroupName: "Table 2",
      role: "student",
    });
  });
});

describe("filterAssignerPreviewRows", () => {
  const rows = buildAssignerPreviewRows(
    [
      assignment({
        studentUserId: "a" as Id<"users">,
        firstName: "Ada",
        lastName: "Lovelace",
        studentDisplayName: "Ada Lovelace",
      }),
      assignment({
        studentUserId: "b" as Id<"users">,
        firstName: "Grace",
        lastName: "Hopper",
        studentDisplayName: "Grace Hopper",
        item: "Tablet",
      }),
    ],
    undefined,
  );

  it("returns all rows when filters are empty", () => {
    expect(filterAssignerPreviewRows(rows, { firstName: "", lastName: "", name: "" })).toHaveLength(
      2,
    );
  });

  it("filters the first-name column independently", () => {
    const filtered = filterAssignerPreviewRows(rows, {
      firstName: "gra",
      lastName: "",
      name: "",
    });
    expect(filtered.map((row) => row.userId)).toEqual(["b"]);
  });

  it("filters the combined name column across first and last", () => {
    const filtered = filterAssignerPreviewRows(rows, {
      firstName: "",
      lastName: "",
      name: "ada love",
    });
    expect(filtered.map((row) => row.lastName)).toEqual(["Lovelace"]);
  });
});

describe("isAssignerPreviewRosterRow", () => {
  it("recognizes preview rows and rejects plain roster entries", () => {
    const [preview] = buildAssignerPreviewRows(
      [assignment({ studentUserId: "c" as Id<"users"> })],
      undefined,
    );
    expect(preview && isAssignerPreviewRosterRow(preview)).toBe(true);
    expect(isAssignerPreviewRosterRow(rosterEntry({ userId: "c" as Id<"users"> }))).toBe(false);
  });
});
