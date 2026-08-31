import { describe, expect, test } from "vite-plus/test";

import {
  compactRosterDisplayNames,
  DEFAULT_ROSTER_NAME_FORMAT,
  formatRosterNameParts,
  getRosterDisplayName,
  resolveRosterNameFormat,
} from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

function student(
  userId: string,
  fields: { firstName?: string; lastName?: string; name?: string; email?: string },
) {
  return { userId: userId as Id<"users">, ...fields };
}

function compactNames(
  students: Parameters<typeof compactRosterDisplayNames>[0],
  format?: Parameters<typeof compactRosterDisplayNames>[2],
) {
  return compactRosterDisplayNames(students, "Unnamed", format);
}

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

describe("compactRosterDisplayNames", () => {
  test("keeps unique given names", () => {
    const names = compactNames([
      student("u1", { firstName: "Alex", lastName: "Kim" }),
      student("u2", { firstName: "Sam", lastName: "Park" }),
    ]);
    expect(names.get("u1" as Id<"users">)).toBe("Alex");
    expect(names.get("u2" as Id<"users">)).toBe("Sam");
  });

  test("adds a Latin surname initial only for colliding given names", () => {
    const names = compactNames([
      student("u1", { firstName: "Alex", lastName: "Kim" }),
      student("u2", { firstName: "Alex", lastName: "Lee" }),
      student("u3", { firstName: "Sam", lastName: "Park" }),
    ]);
    expect(names.get("u1" as Id<"users">)).toBe("Alex K.");
    expect(names.get("u2" as Id<"users">)).toBe("Alex L.");
    expect(names.get("u3" as Id<"users">)).toBe("Sam");
  });

  test("keeps the compact Latin label when full names also match", () => {
    const names = compactNames([
      student("u1", { firstName: "Alex", lastName: "Kim" }),
      student("u2", { firstName: "Alex", lastName: "Kim" }),
    ]);
    expect(names.get("u1" as Id<"users">)).toBe("Alex K.");
    expect(names.get("u2" as Id<"users">)).toBe("Alex K.");
  });

  test("adds more Latin surname letters when the first initial matches", () => {
    const names = compactNames([
      student("u1", { firstName: "Alex", lastName: "Kim" }),
      student("u2", { firstName: "Alex", lastName: "King" }),
      student("u3", { firstName: "Sam", lastName: "Park" }),
    ]);
    expect(names.get("u1" as Id<"users">)).toBe("Alex Kim.");
    expect(names.get("u2" as Id<"users">)).toBe("Alex Kin.");
    expect(names.get("u3" as Id<"users">)).toBe("Sam");
  });

  test("uses the next letter when one Latin surname is a prefix of another", () => {
    const names = compactNames([
      student("u1", { firstName: "Alex", lastName: "Kim" }),
      student("u2", { firstName: "Alex", lastName: "Kimberly" }),
    ]);
    expect(names.get("u1" as Id<"users">)).toBe("Alex Kim.");
    expect(names.get("u2" as Id<"users">)).toBe("Alex Kimb.");
  });

  test("expands only against different surnames when some names match exactly", () => {
    const names = compactNames([
      student("u1", { firstName: "Alex", lastName: "Kim" }),
      student("u2", { firstName: "Alex", lastName: "Kim" }),
      student("u3", { firstName: "Alex", lastName: "King" }),
    ]);
    expect(names.get("u1" as Id<"users">)).toBe("Alex Kim.");
    expect(names.get("u2" as Id<"users">)).toBe("Alex Kim.");
    expect(names.get("u3" as Id<"users">)).toBe("Alex Kin.");
  });

  test("expands matching Latin initials that start with the same letter", () => {
    const names = compactNames([
      student("u1", { firstName: "Alex", lastName: "García" }),
      student("u2", { firstName: "Alex", lastName: "Gomez" }),
    ]);
    expect(names.get("u1" as Id<"users">)).toBe("Alex Ga.");
    expect(names.get("u2" as Id<"users">)).toBe("Alex Go.");
  });

  test("uses the given name when a colliding student has no surname", () => {
    const names = compactNames([
      student("u1", { firstName: "Alex", lastName: "Kim" }),
      student("u2", { firstName: "Alex" }),
    ]);
    expect(names.get("u1" as Id<"users">)).toBe("Alex K.");
    expect(names.get("u2" as Id<"users">)).toBe("Alex");
  });

  test("falls back to account name when roster names are empty", () => {
    const names = compactNames([student("u1", { name: "Ada Lovelace", email: "ada@example.com" })]);
    expect(names.get("u1" as Id<"users">)).toBe("Ada Lovelace");
  });

  test("keeps a last-only student as the fallback display name", () => {
    const names = compactNames([student("u1", { lastName: "Kim", name: "Account" })]);
    expect(names.get("u1" as Id<"users">)).toBe("Kim");
  });

  test("uses a grapheme-safe accented Latin initial", () => {
    const names = compactNames([
      student("u1", { firstName: "Alex", lastName: "Émile" }),
      student("u2", { firstName: "Alex", lastName: "E\u0301mile" }),
    ]);
    expect(names.get("u1" as Id<"users">)).toBe("Alex É.");
    expect(names.get("u2" as Id<"users">)).toBe("Alex É.");
  });

  test("does not treat accented given names as the same after NFC only", () => {
    const names = compactNames([
      student("u1", { firstName: "José", lastName: "García" }),
      student("u2", { firstName: "Jose", lastName: "Gomez" }),
    ]);
    expect(names.get("u1" as Id<"users">)).toBe("José");
    expect(names.get("u2" as Id<"users">)).toBe("Jose");
  });

  test("shows the full roster name for non-Latin colliding surnames", () => {
    const names = compactNames([
      student("u1", { firstName: "민수", lastName: "김" }),
      student("u2", { firstName: "민수", lastName: "박" }),
    ]);
    expect(names.get("u1" as Id<"users">)).toBe("민수 김");
    expect(names.get("u2" as Id<"users">)).toBe("민수 박");
  });

  test("shows the full roster name for mixed-script colliding surnames", () => {
    const names = compactNames([
      student("u1", { firstName: "Alex", lastName: "Kim김" }),
      student("u2", { firstName: "Alex", lastName: "Lee이" }),
    ]);
    expect(names.get("u1" as Id<"users">)).toBe("Alex Kim김");
    expect(names.get("u2" as Id<"users">)).toBe("Alex Lee이");
  });

  test("honors class name order and spacing for non-Latin collisions", () => {
    const names = compactNames(
      [
        student("u1", { firstName: "민수", lastName: "김" }),
        student("u2", { firstName: "민수", lastName: "박" }),
      ],
      { order: "lastFirst", space: false },
    );
    expect(names.get("u1" as Id<"users">)).toBe("김민수");
    expect(names.get("u2" as Id<"users">)).toBe("박민수");
  });

  test("detects collisions from the full roster, not a filtered subset", () => {
    const full = [
      student("u1", { firstName: "Alex", lastName: "Kim" }),
      student("u2", { firstName: "Alex", lastName: "Lee" }),
      student("u3", { firstName: "Sam", lastName: "Park" }),
    ];
    const names = compactNames(full);
    const visible = full.filter((entry) => entry.userId === ("u1" as Id<"users">));
    expect(visible).toHaveLength(1);
    expect(names.get("u1" as Id<"users">)).toBe("Alex K.");
  });

  test("skips punctuation when taking a Latin initial", () => {
    const names = compactNames([
      student("u1", { firstName: "Alex", lastName: "'t Hart" }),
      student("u2", { firstName: "Alex", lastName: "O'Brien" }),
    ]);
    expect(names.get("u1" as Id<"users">)).toBe("Alex t.");
    expect(names.get("u2" as Id<"users">)).toBe("Alex O.");
  });
});
