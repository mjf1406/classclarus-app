import { describe, expect, test } from "vite-plus/test";

import {
  migrateLessonSections,
  migrateSubjectSections,
  stripMissingAgendaReferences,
} from "./sectionMigration";
import type { Id } from "../../_generated/dataModel";

describe("migrateLessonSections", () => {
  test("discards notes and converts every legacy link kind", () => {
    const result = migrateLessonSections({
      notesJson: '{"type":"doc"}',
      links: [
        { key: "u", kind: "url", url: "https://files.example/a.pdf", label: "PDF" },
        {
          key: "a",
          kind: "assignment",
          assignmentId: "assignments:a" as Id<"assignments">,
          label: "Essay",
        },
        { key: "t", kind: "task", taskId: "tasks:t" as Id<"tasks">, label: "Read" },
      ],
    });

    expect(result.notesJson).toBeUndefined();
    expect(result.links).toEqual([]);
    expect(result.announcements).toEqual([]);
    expect(result.materials).toHaveLength(1);
    expect(result.materials[0]?.text).toContain("https://files.example/a.pdf");
    expect(result.agenda.map((item) => item.key)).toEqual(["a", "t"]);
  });

  test("keeps already-migrated sections and still clears notes", () => {
    const result = migrateLessonSections({
      notesJson: '{"type":"doc"}',
      materials: [{ key: "m", text: "Kept", tags: [] }],
      announcements: [],
      agenda: [],
      links: [{ key: "old", kind: "url", url: "https://old.example" }],
    });
    expect(result.notesJson).toBeUndefined();
    expect(result.materials).toEqual([{ key: "m", text: "Kept", tags: [] }]);
  });
});

describe("migrateSubjectSections", () => {
  test("discards default notes and seeds empty section defaults", () => {
    const result = migrateSubjectSections({
      defaultNotesJson: '{"type":"doc"}',
    });
    expect(result.defaultNotesJson).toBeUndefined();
    expect(result.defaultMaterials).toEqual([]);
    expect(result.defaultAnnouncements).toEqual([]);
    expect(result.defaultAgenda).toEqual([]);
    expect(result.calendarAudienceRoles).toEqual(["student"]);
  });

  test("keeps already-migrated subject defaults", () => {
    const result = migrateSubjectSections({
      defaultMaterials: [{ key: "m", text: "Ruler", tags: [] }],
      calendarAudienceRoles: ["teacher", "student"],
    });
    expect(result.defaultMaterials).toEqual([{ key: "m", text: "Ruler", tags: [] }]);
    expect(result.calendarAudienceRoles).toEqual(["teacher", "student"]);
  });
});

describe("stripMissingAgendaReferences", () => {
  test("clears ids whose documents are gone and keeps leftover text", async () => {
    const assignmentId = "assignments:gone" as Id<"assignments">;
    const taskId = "tasks:live" as Id<"tasks">;
    const ctx = {
      db: {
        get: async (table: "assignments" | "tasks", id: Id<"assignments"> | Id<"tasks">) => {
          if (table === "tasks" && id === taskId) return { _id: id };
          return null;
        },
      },
    };
    await expect(
      stripMissingAgendaReferences(ctx, [
        { key: "a", text: "Quiz", tags: [], assignmentId },
        { key: "t", text: "Warm-up", tags: [], taskId },
      ]),
    ).resolves.toEqual([
      { key: "a", text: "Quiz", tags: [] },
      { key: "t", text: "Warm-up", tags: [], taskId },
    ]);
  });

  test("returns undefined when every referenced document still exists", async () => {
    const assignmentId = "assignments:1" as Id<"assignments">;
    const ctx = {
      db: {
        get: async () => ({ _id: assignmentId }),
      },
    };
    await expect(
      stripMissingAgendaReferences(ctx, [{ key: "a", text: "Quiz", tags: [], assignmentId }]),
    ).resolves.toBeUndefined();
  });
});
