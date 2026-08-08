import { describe, expect, test } from "vite-plus/test";

import { isTaskPastDue } from "@/lib/tasks/tasks";
import { completionTone } from "@/components/tasks/taskCompletionTone";

describe("isTaskPastDue", () => {
  test("false when no due date", () => {
    expect(isTaskPastDue(undefined, "2026-08-08")).toBe(false);
  });

  test("false when due today or in the future", () => {
    expect(isTaskPastDue("2026-08-08", "2026-08-08")).toBe(false);
    expect(isTaskPastDue("2026-08-09", "2026-08-08")).toBe(false);
  });

  test("true when due before today", () => {
    expect(isTaskPastDue("2026-08-07", "2026-08-08")).toBe(true);
  });
});

describe("completionTone", () => {
  test("done wins over past due", () => {
    expect(completionTone(true, true)).toBe("done");
  });

  test("late supersedes notDone when incomplete and past due", () => {
    expect(completionTone(false, true)).toBe("late");
  });

  test("notDone when incomplete and on time", () => {
    expect(completionTone(false, false)).toBe("notDone");
  });
});
