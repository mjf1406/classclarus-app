import { describe, expect, test } from "vite-plus/test";

import {
  parseTimetableSearch,
  toDateSearchParam,
  clampDateToTerm,
} from "@/lib/timetable/timetableSearch";

describe("parseTimetableSearch", () => {
  test("defaults to week view and today when search is empty", () => {
    const { view, weekStart } = parseTimetableSearch({});
    expect(view).toBe("week");
    expect(weekStart).toBeInstanceOf(Date);
  });

  test("parses day view and explicit date", () => {
    const { view, currentDate } = parseTimetableSearch({
      view: "day",
      date: "2026-03-15",
    });
    expect(view).toBe("day");
    expect(currentDate.getFullYear()).toBe(2026);
    expect(currentDate.getMonth()).toBe(2);
    expect(currentDate.getDate()).toBe(15);
  });
});

describe("toDateSearchParam", () => {
  test("formats local date as YYYY-MM-DD", () => {
    const date = new Date(2026, 2, 5);
    expect(toDateSearchParam(date)).toBe("2026-03-05");
  });
});

describe("clampDateToTerm", () => {
  test("clamps before start to term start", () => {
    const clamped = clampDateToTerm(new Date(2026, 0, 1), "2026-03-01", "2026-06-30");
    expect(toDateSearchParam(clamped)).toBe("2026-03-01");
  });

  test("clamps after end to term end", () => {
    const clamped = clampDateToTerm(new Date(2026, 11, 31), "2026-03-01", "2026-06-30");
    expect(toDateSearchParam(clamped)).toBe("2026-06-30");
  });
});
