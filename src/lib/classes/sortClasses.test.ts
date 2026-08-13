import { describe, expect, test } from "vite-plus/test";

import type { ClassPublic } from "./classes";
import { sortClasses } from "./classes";

function makeClass(name: string): ClassPublic {
  return {
    _id: `class_${name}` as ClassPublic["_id"],
    _creationTime: 0,
    name,
    year: 2026,
    updatedAt: 0,
    role: "owner",
  } as ClassPublic;
}

describe("sortClasses", () => {
  test("accepts app language codes that are not raw BCP 47 tags", () => {
    const classes = [makeClass("Beta"), makeClass("Alpha")];
    expect(() => sortClasses(classes, "engb")).not.toThrow();
    expect(sortClasses(classes, "engb").map((item) => item.name)).toEqual(
      sortClasses(classes, "en-GB").map((item) => item.name),
    );
  });
});
