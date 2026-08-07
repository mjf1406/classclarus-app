import { describe, expect, test } from "vite-plus/test";

import {
  DEFAULT_ROSTER_NAME_FORMAT,
  formatRosterNameParts,
  getRosterDisplayName,
  resolveRosterNameFormat,
} from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

describe("formatRosterNameParts", () => {
  test("defaults to first last with space", () => {
    expect(formatRosterNameParts("Alex", "Kim")).toBe("Alex Kim");
    expect(formatRosterNameParts("Alex", "Kim", DEFAULT_ROSTER_NAME_FORMAT)).toBe("Alex Kim");
  });

  test("supports last first and no space", () => {
    expect(formatRosterNameParts("Alex", "Kim", { order: "lastFirst", space: true })).toBe(
      "Kim Alex",
    );
    expect(formatRosterNameParts("Alex", "Kim", { order: "firstLast", space: false })).toBe(
      "AlexKim",
    );
    expect(formatRosterNameParts("Alex", "Kim", { order: "lastFirst", space: false })).toBe(
      "KimAlex",
    );
  });

  test("handles single part", () => {
    expect(formatRosterNameParts("Alex", undefined)).toBe("Alex");
    expect(formatRosterNameParts(undefined, "Kim", { order: "lastFirst", space: false })).toBe(
      "Kim",
    );
    expect(formatRosterNameParts("  ", "  ")).toBeUndefined();
  });
});

describe("resolveRosterNameFormat", () => {
  test("defaults unset fields", () => {
    expect(resolveRosterNameFormat({})).toEqual({ order: "firstLast", space: true });
    expect(resolveRosterNameFormat({ rosterNameSpace: false })).toEqual({
      order: "firstLast",
      space: false,
    });
  });
});

describe("getRosterDisplayName", () => {
  test("uses roster format then falls back to account name", () => {
    const student = {
      userId: "u1" as Id<"users">,
      firstName: "Alex",
      lastName: "Kim",
      name: "Account Name",
      email: "a@example.com",
    };
    expect(getRosterDisplayName(student, "Unnamed", { order: "lastFirst", space: false })).toBe(
      "KimAlex",
    );
    expect(
      getRosterDisplayName({ ...student, firstName: undefined, lastName: undefined }, "Unnamed"),
    ).toBe("Account Name");
  });
});
