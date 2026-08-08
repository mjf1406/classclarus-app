import { describe, expect, test } from "vite-plus/test";

import {
  coerceDueDateKeyForInput,
  isPastDue,
  isValidDueDateKey,
  normalizeDueDateKey,
  parseDueDateKey,
} from "@/lib/dueDate/dueDateKey";

describe("isValidDueDateKey", () => {
  test("accepts date and datetime", () => {
    expect(isValidDueDateKey("2026-08-08")).toBe(true);
    expect(isValidDueDateKey("2026-08-08T15:30")).toBe(true);
    expect(isValidDueDateKey("2026-08-08T15:30:00")).toBe(true);
  });

  test("rejects invalid values", () => {
    expect(isValidDueDateKey("2026-13-01")).toBe(false);
    expect(isValidDueDateKey("2026-08-08T24:00")).toBe(false);
    expect(isValidDueDateKey("2026-08-08 15:30")).toBe(false);
  });
});

describe("normalizeDueDateKey", () => {
  test("strips seconds to minute precision", () => {
    expect(normalizeDueDateKey("2026-08-08T15:30:45")).toBe("2026-08-08T15:30");
  });
});

describe("parseDueDateKey", () => {
  test("parses local datetime parts", () => {
    const date = parseDueDateKey("2026-08-08T15:30");
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(7);
    expect(date?.getDate()).toBe(8);
    expect(date?.getHours()).toBe(15);
    expect(date?.getMinutes()).toBe(30);
  });
});

describe("coerceDueDateKeyForInput", () => {
  test("appends midnight for legacy date-only", () => {
    expect(coerceDueDateKeyForInput("2026-08-08")).toBe("2026-08-08T00:00");
    expect(coerceDueDateKeyForInput("2026-08-08T15:30")).toBe("2026-08-08T15:30");
    expect(coerceDueDateKeyForInput(undefined)).toBe("");
  });
});

describe("isPastDue", () => {
  test("false when no due date", () => {
    expect(isPastDue(undefined, new Date(2026, 7, 8, 12, 0))).toBe(false);
  });

  test("date-only: due today is on time; yesterday is late", () => {
    const now = new Date(2026, 7, 8, 12, 0);
    expect(isPastDue("2026-08-08", now)).toBe(false);
    expect(isPastDue("2026-08-09", now)).toBe(false);
    expect(isPastDue("2026-08-07", now)).toBe(true);
  });

  test("datetime: compares against now", () => {
    const now = new Date(2026, 7, 8, 15, 0);
    expect(isPastDue("2026-08-08T14:59", now)).toBe(true);
    expect(isPastDue("2026-08-08T15:00", now)).toBe(false);
    expect(isPastDue("2026-08-08T15:01", now)).toBe(false);
  });
});
