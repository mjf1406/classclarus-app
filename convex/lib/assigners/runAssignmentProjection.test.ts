import { describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel.js";
import {
  isStaffAssignerRunAssignment,
  projectAssignerRunAssignments,
  type StoredAssignerRunAssignment,
} from "./runAssignmentProjection.js";

const userId = "user1" as Id<"users">;
const groupId = "group1" as Id<"groups">;

const storedAssignment: StoredAssignerRunAssignment = {
  studentUserId: userId,
  studentDisplayName: "Ada Lovelace",
  item: "Chromebook 1",
  rosterNumber: 3,
  firstName: "Ada",
  lastName: "Lovelace",
  groupId,
  groupName: "Table 1",
};

describe("projectAssignerRunAssignments", () => {
  test("returns the full snapshot for staff roster readers", () => {
    const projected = projectAssignerRunAssignments([storedAssignment], true);
    expect(projected).toEqual([storedAssignment]);
    expect(isStaffAssignerRunAssignment(projected[0]!)).toBe(true);
  });

  test("strips staff-only fields for consumer roster readers", () => {
    const projected = projectAssignerRunAssignments([storedAssignment], false);
    expect(projected).toEqual([
      {
        studentUserId: userId,
        rosterNumber: 3,
        firstName: "Ada",
        lastName: "Lovelace",
        item: "Chromebook 1",
        groupName: "Table 1",
      },
    ]);
    expect(isStaffAssignerRunAssignment(projected[0]!)).toBe(false);
    expect(Object.keys(projected[0]!).sort()).toEqual([
      "firstName",
      "groupName",
      "item",
      "lastName",
      "rosterNumber",
      "studentUserId",
    ]);
  });
});
