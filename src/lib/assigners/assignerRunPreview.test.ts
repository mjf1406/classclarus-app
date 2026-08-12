import { describe, expect, it } from "vite-plus/test";

import type { Id } from "../../../convex/_generated/dataModel";
import type { StudentRosterEntry } from "@/lib/roster/roster";
import {
  buildAssignerPreviewRows,
  buildConsumerAssignerPreviewRows,
  filterAssignerPreviewRows,
  filterConsumerAssignerPreviewRows,
  isAssignerPreviewRosterRow,
  type StaffAssignerPreviewAssignment,
} from "./assignerRunPreview";

function assignment(
  overrides: Partial<StaffAssignerPreviewAssignment> &
    Pick<StaffAssignerPreviewAssignment, "studentUserId">,
): StaffAssignerPreviewAssignment {
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

describe("buildConsumerAssignerPreviewRows", () => {
  it("builds allowlisted roster rows without account or contact fields", () => {
    const rows = buildConsumerAssignerPreviewRows([
      {
        studentUserId: "user3" as Id<"users">,
        rosterNumber: 4,
        firstName: "Grace",
        lastName: "Hopper",
        item: "Tablet",
        groupName: "Table 2",
      },
    ]);

    expect(rows[0]).toEqual({
      userId: "user3",
      rosterNumber: 4,
      firstName: "Grace",
      lastName: "Hopper",
      role: "student",
      assignmentIndex: 0,
      assignedItem: "Tablet",
      assignedGroupName: "Table 2",
    });
    expect(rows[0]).not.toHaveProperty("email");
    expect(rows[0]).not.toHaveProperty("name");
    expect(rows[0]).not.toHaveProperty("gender");
  });

  it("still renders rows when the payload still includes staff-only fields", () => {
    const rows = buildConsumerAssignerPreviewRows([
      {
        studentUserId: "user4" as Id<"users">,
        studentDisplayName: "Ada Lovelace",
        rosterNumber: 1,
        firstName: "Ada",
        lastName: "Lovelace",
        item: "CB-1",
        groupId: "g1" as Id<"groups">,
        groupName: "Table 1",
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      userId: "user4",
      rosterNumber: 1,
      firstName: "Ada",
      lastName: "Lovelace",
      role: "student",
      assignmentIndex: 0,
      assignedItem: "CB-1",
      assignedGroupName: "Table 1",
    });
    expect(rows[0]).not.toHaveProperty("email");
    expect(rows[0]).not.toHaveProperty("name");
    expect(rows[0]).not.toHaveProperty("groupId");
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

describe("filterConsumerAssignerPreviewRows", () => {
  const rows = buildConsumerAssignerPreviewRows([
    {
      studentUserId: "a" as Id<"users">,
      firstName: "Ada",
      lastName: "Lovelace",
      item: "CB-1",
    },
    {
      studentUserId: "b" as Id<"users">,
      firstName: "Grace",
      lastName: "Hopper",
      item: "CB-2",
    },
  ]);

  it("filters only first and last name for consumer rows", () => {
    const filtered = filterConsumerAssignerPreviewRows(rows, {
      firstName: "gra",
      lastName: "",
    });
    expect(filtered.map((row) => row.userId)).toEqual(["b"]);
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
