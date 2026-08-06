import { describe, expect, test } from "vite-plus/test";

import {
  classFormSchema,
  deleteConfirmationPhrase,
  isEmojiIcon,
  isFontAwesomeIconId,
} from "@/lib/classes/classFormSchema";
import { nextSortState, partitionClassesByArchive, sortClasses } from "@/lib/classes/classSort";

describe("classFormSchema", () => {
  test("accepts required name and year with optional fields cleared", () => {
    const result = classFormSchema.parse({
      name: "  Biology  ",
      year: "2026",
      description: "  ",
      icon: "",
    });
    expect(result).toEqual({
      name: "Biology",
      year: 2026,
      description: undefined,
      icon: undefined,
    });
  });

  test("accepts font awesome icon ids and emoji", () => {
    expect(
      classFormSchema.parse({ name: "A", year: "2026", description: "", icon: "fas:book" }).icon,
    ).toBe("fas:book");
    expect(
      classFormSchema.parse({ name: "A", year: "2026", description: "", icon: "🎓" }).icon,
    ).toBe("🎓");
    expect(isFontAwesomeIconId("far:user")).toBe(true);
    expect(isEmojiIcon("📘")).toBe(true);
  });

  test("rejects invalid year and icon", () => {
    expect(() =>
      classFormSchema.parse({ name: "A", year: "1800", description: "", icon: "" }),
    ).toThrow();
    expect(() =>
      classFormSchema.parse({ name: "A", year: "2026", description: "", icon: "not-an-icon" }),
    ).toThrow();
  });

  test("builds delete confirmation phrase", () => {
    expect(deleteConfirmationPhrase("Biology")).toBe("delete Biology");
  });
});

describe("classSort", () => {
  const classes = [
    {
      _id: "1",
      _creationTime: 100,
      name: "Zebra",
      year: 2024,
      updatedAt: 300,
    },
    {
      _id: "2",
      _creationTime: 200,
      name: "Alpha",
      year: 2025,
      updatedAt: 100,
      archivedAt: 400,
    },
    {
      _id: "3",
      _creationTime: 150,
      name: "Beta",
      year: 2026,
      updatedAt: 250,
    },
  ];

  test("sorts by name ascending", () => {
    expect(sortClasses(classes, "name", "asc").map((item) => item.name)).toEqual([
      "Alpha",
      "Beta",
      "Zebra",
    ]);
  });

  test("sorts by created descending", () => {
    expect(sortClasses(classes, "created", "desc").map((item) => item._id)).toEqual([
      "2",
      "3",
      "1",
    ]);
  });

  test("partitions active and archived", () => {
    const { active, archived } = partitionClassesByArchive(classes);
    expect(active.map((item) => item._id)).toEqual(["1", "3"]);
    expect(archived.map((item) => item._id)).toEqual(["2"]);
  });

  test("toggles direction for the same key and defaults for new keys", () => {
    expect(nextSortState("name", "asc", "name")).toEqual({
      sortKey: "name",
      sortDirection: "desc",
    });
    expect(nextSortState("name", "asc", "updated")).toEqual({
      sortKey: "updated",
      sortDirection: "desc",
    });
  });
});
