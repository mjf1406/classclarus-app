import { describe, expect, test } from "vite-plus/test";

import {
  AGENDA_ITEM_LIMIT,
  appendAgendaItems,
  agendaItemKind,
  agendaNamedLinkLabel,
  agendaPrefaceText,
  createAssignmentAgendaItem,
  createTaskAgendaItem,
  createTextAgendaItem,
  excludeExistingTaskIds,
  findAgendaResourceName,
  selectTasksForAssignment,
  type AgendaTaskSource,
} from "@/lib/timetable/agendaItems";
import type { AgendaItemFormValues } from "@/lib/timetable/timetable";

function item(overrides: Partial<AgendaItemFormValues> & { key: string }): AgendaItemFormValues {
  return { text: "", tags: [], ...overrides };
}

const assignmentTasks: Array<AgendaTaskSource> = [
  { _id: "t-c", name: "Collect", assignmentId: "a1", procedureStepNumber: 3 },
  { _id: "t-a", name: "Warm-up", assignmentId: "a1", procedureStepNumber: 1 },
  { _id: "t-b", name: "Practice", assignmentId: "a1", procedureStepNumber: 2 },
  { _id: "t-other", name: "Other", assignmentId: "a2", procedureStepNumber: 1 },
  { _id: "t-solo", name: "Solo" },
];

describe("agendaItemKind", () => {
  test("returns task when both ids are set", () => {
    expect(agendaItemKind({ assignmentId: "asg", taskId: "task" })).toBe("task");
  });

  test("returns assignment when only assignmentId is set", () => {
    expect(agendaItemKind({ assignmentId: "asg" })).toBe("assignment");
  });

  test("returns text when no ids are set", () => {
    expect(agendaItemKind({})).toBe("text");
  });
});

describe("create agenda items", () => {
  test("creates a blank text item", () => {
    expect(createTextAgendaItem("k1")).toEqual({ key: "k1", text: "", tags: [] });
  });

  test("creates an assignment item with a name snapshot", () => {
    expect(createAssignmentAgendaItem("k2", { _id: "asg-1", name: "Quiz #check" })).toEqual({
      key: "k2",
      text: "Quiz #check",
      tags: ["check"],
      assignmentId: "asg-1",
    });
  });

  test("creates a task item with a name snapshot", () => {
    expect(createTaskAgendaItem("k3", { _id: "task-1", name: "Read #pages" })).toEqual({
      key: "k3",
      text: "Read #pages",
      tags: ["pages"],
      taskId: "task-1",
    });
  });
});

describe("selectTasksForAssignment", () => {
  test("returns procedure tasks in step order", () => {
    expect(selectTasksForAssignment(assignmentTasks, "a1").map((task) => task._id)).toEqual([
      "t-a",
      "t-b",
      "t-c",
    ]);
  });

  test("returns an empty list when the assignment has no tasks", () => {
    expect(selectTasksForAssignment(assignmentTasks, "missing")).toEqual([]);
  });
});

describe("excludeExistingTaskIds", () => {
  test("drops tasks already linked on the agenda", () => {
    const remaining = excludeExistingTaskIds(assignmentTasks, [
      item({ key: "1", taskId: "t-a" }),
      item({ key: "2", assignmentId: "asg" }),
    ]);
    expect(remaining.map((task) => task._id)).toEqual(["t-c", "t-b", "t-other", "t-solo"]);
  });
});

describe("appendAgendaItems", () => {
  test("appends items and skips duplicate task ids by default", () => {
    const existing = [item({ key: "1", taskId: "t-a", text: "Warm-up" })];
    const result = appendAgendaItems(existing, [
      createTaskAgendaItem("2", { _id: "t-a", name: "Warm-up" }),
      createTaskAgendaItem("3", { _id: "t-b", name: "Practice" }),
    ]);

    expect(result.added).toBe(1);
    expect(result.skippedDuplicates).toBe(1);
    expect(result.skippedLimit).toBe(0);
    expect(result.items.map((row) => row.key)).toEqual(["1", "3"]);
  });

  test("can keep a duplicate task when skip is off", () => {
    const existing = [item({ key: "1", taskId: "t-a" })];
    const result = appendAgendaItems(
      existing,
      [createTaskAgendaItem("2", { _id: "t-a", name: "A" })],
      {
        skipDuplicateTaskIds: false,
      },
    );
    expect(result.added).toBe(1);
    expect(result.skippedDuplicates).toBe(0);
    expect(result.items).toHaveLength(2);
  });

  test("stops at the agenda item limit", () => {
    const existing = Array.from({ length: AGENDA_ITEM_LIMIT - 1 }, (_, index) =>
      item({ key: `e${index}` }),
    );
    const incoming = [
      createAssignmentAgendaItem("a", { _id: "asg", name: "Quiz" }),
      createTaskAgendaItem("b", { _id: "t-b", name: "Practice" }),
    ];
    const result = appendAgendaItems(existing, incoming);

    expect(result.added).toBe(1);
    expect(result.skippedLimit).toBe(1);
    expect(result.items).toHaveLength(AGENDA_ITEM_LIMIT);
    expect(result.items.at(-1)?.assignmentId).toBe("asg");
  });

  test("reports none added when already at the limit", () => {
    const existing = Array.from({ length: AGENDA_ITEM_LIMIT }, (_, index) =>
      item({ key: `e${index}` }),
    );
    const result = appendAgendaItems(existing, [createTextAgendaItem("new")]);
    expect(result).toEqual({
      items: existing,
      added: 0,
      skippedDuplicates: 0,
      skippedLimit: 1,
    });
  });
});

describe("agenda resource labels", () => {
  test("finds a resource name by id", () => {
    expect(
      findAgendaResourceName(
        [
          { _id: "a1", name: "Quiz" },
          { _id: "a2", name: "Essay" },
        ],
        "a2",
      ),
    ).toBe("Essay");
    expect(findAgendaResourceName([{ _id: "a1", name: "Quiz" }], "missing")).toBeUndefined();
    expect(findAgendaResourceName(undefined, "a1")).toBeUndefined();
  });

  test("prefers the live name, then item text, then the fallback", () => {
    expect(agendaNamedLinkLabel(" Quiz ", "snapshot", "Assignment")).toBe("Quiz");
    expect(agendaNamedLinkLabel(undefined, " snapshot ", "Assignment")).toBe("snapshot");
    expect(agendaNamedLinkLabel("  ", "  ", "Assignment")).toBe("Assignment");
  });

  test("returns trimmed preface text and ignores blanks", () => {
    expect(agendaPrefaceText("  Center #1:  ")).toBe("Center #1:");
    expect(agendaPrefaceText("   ")).toBeUndefined();
    expect(agendaPrefaceText(undefined)).toBeUndefined();
  });
});
