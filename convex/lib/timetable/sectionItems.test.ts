import { describe, expect, test } from "vite-plus/test";

import {
  attachAgendaResourceNames,
  collectItemTags,
  exclusiveAgendaLinkIds,
  extractHashtags,
  isValidTag,
  migrateLegacyLinks,
  normalizeSectionItems,
  normalizeTag,
  splitTextWithUrls,
  stripAgendaItemReferences,
  toAgendaItems,
} from "./sectionItems";
import type { LessonLinkInput } from "./timetableSchema";
import type { Id } from "../../_generated/dataModel";

describe("hashtag helpers", () => {
  test("normalizes spelling and strips a leading hash", () => {
    expect(normalizeTag("#Homework")).toBe("homework");
    expect(normalizeTag("  Review ")).toBe("review");
  });

  test("accepts letters, digits, underscore, and hyphen", () => {
    expect(isValidTag("week-1")).toBe(true);
    expect(isValidTag("unit_2")).toBe(true);
    expect(isValidTag("9am")).toBe(true);
    expect(isValidTag("-bad")).toBe(false);
    expect(isValidTag("has space")).toBe(false);
    expect(isValidTag("")).toBe(false);
  });

  test("extracts unique hashtags in order from text", () => {
    expect(extractHashtags("Bring #Book and #book plus #quiz-2")).toEqual(["book", "quiz-2"]);
  });

  test("collects tags from item text when stored tags are empty", () => {
    expect(collectItemTags([{ text: "See #math #science", tags: [] }])).toEqual([
      "math",
      "science",
    ]);
  });
});

describe("normalizeSectionItems", () => {
  test("drops blank rows and stores tags from text", () => {
    expect(
      normalizeSectionItems([
        { key: "a", text: "  Worksheet #hw  ", tags: [] },
        { key: "b", text: "   ", tags: [] },
      ]),
    ).toEqual([{ key: "a", text: "Worksheet #hw", tags: ["hw"] }]);
  });

  test("rejects duplicate keys", () => {
    expect(() =>
      normalizeSectionItems([
        { key: "a", text: "One", tags: [] },
        { key: "a", text: "Two", tags: [] },
      ]),
    ).toThrow("Duplicate item key");
  });
});

describe("splitTextWithUrls", () => {
  test("keeps surrounding text and isolates URLs", () => {
    expect(splitTextWithUrls("See https://example.com/a now")).toEqual([
      { type: "text", value: "See " },
      { type: "url", value: "https://example.com/a" },
      { type: "text", value: " now" },
    ]);
  });
});

describe("migrateLegacyLinks", () => {
  test("converts every legacy link kind", () => {
    const assignmentId = "assignments:1" as Id<"assignments">;
    const taskId = "tasks:1" as Id<"tasks">;
    const links: Array<LessonLinkInput> = [
      { key: "url-1", kind: "url", url: "https://example.com/pack", label: "Pack" },
      { key: "url-2", kind: "url", url: "https://example.com/bare" },
      { key: "asg-1", kind: "assignment", assignmentId, label: "Quiz #check" },
      { key: "task-1", kind: "task", taskId, label: "Warm-up" },
    ];

    const migrated = migrateLegacyLinks(links);
    expect(migrated.materials).toEqual([
      { key: "url-1", text: "Pack https://example.com/pack", tags: [] },
      { key: "url-2", text: "https://example.com/bare", tags: [] },
    ]);
    expect(migrated.agenda).toEqual([
      {
        key: "asg-1",
        text: "Quiz #check",
        tags: ["check"],
        assignmentId,
      },
      { key: "task-1", text: "Warm-up", tags: [], taskId },
    ]);
  });
});

describe("exclusiveAgendaLinkIds", () => {
  const assignmentId = "assignments:1" as Id<"assignments">;
  const taskId = "tasks:1" as Id<"tasks">;

  test("keeps taskId and drops assignmentId when both are set", () => {
    expect(exclusiveAgendaLinkIds({ assignmentId, taskId })).toEqual({ taskId });
  });

  test("keeps a lone assignment or task id", () => {
    expect(exclusiveAgendaLinkIds({ assignmentId })).toEqual({ assignmentId });
    expect(exclusiveAgendaLinkIds({ taskId })).toEqual({ taskId });
    expect(exclusiveAgendaLinkIds({})).toEqual({});
  });
});

describe("toAgendaItems", () => {
  test("drops assignmentId when a task is also linked", () => {
    const assignmentId = "assignments:1" as Id<"assignments">;
    const taskId = "tasks:1" as Id<"tasks">;
    expect(
      toAgendaItems([
        { key: "both", text: "Do this", tags: [], assignmentId, taskId },
        { key: "asg", text: "Quiz", tags: [], assignmentId },
      ]),
    ).toEqual([
      { key: "both", text: "Do this", tags: [], taskId },
      { key: "asg", text: "Quiz", tags: [], assignmentId },
    ]);
  });
});

describe("stripAgendaItemReferences", () => {
  const assignmentId = "assignments:1" as Id<"assignments">;
  const taskId = "tasks:1" as Id<"tasks">;

  test("clears matching ids and keeps leftover text", () => {
    expect(
      stripAgendaItemReferences(
        [
          { key: "a", text: "Quiz", tags: ["q"], assignmentId },
          { key: "both", text: "Do this", tags: [], assignmentId, taskId },
        ],
        { assignmentIds: new Set([assignmentId]) },
      ),
    ).toEqual([
      { key: "a", text: "Quiz", tags: ["q"] },
      { key: "both", text: "Do this", tags: [], taskId },
    ]);
  });

  test("drops items that have no text after the last reference is removed", () => {
    expect(
      stripAgendaItemReferences([{ key: "t", text: "   ", tags: [], taskId }], {
        taskIds: new Set([taskId]),
      }),
    ).toEqual([]);
  });
});

describe("attachAgendaResourceNames", () => {
  test("adds live assignment and task names", () => {
    const assignmentId = "assignments:1" as Id<"assignments">;
    const taskId = "tasks:1" as Id<"tasks">;
    expect(
      attachAgendaResourceNames(
        [
          { key: "both", text: "Do this", tags: [], assignmentId, taskId },
          { key: "text", text: "Note", tags: [] },
        ],
        {
          assignments: new Map([[assignmentId, "Quiz"]]),
          tasks: new Map([[taskId, "Warm-up"]]),
        },
      ),
    ).toEqual([
      {
        key: "both",
        text: "Do this",
        tags: [],
        assignmentId,
        taskId,
        assignmentName: "Quiz",
        taskName: "Warm-up",
      },
      { key: "text", text: "Note", tags: [] },
    ]);
  });
});
