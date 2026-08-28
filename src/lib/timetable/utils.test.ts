import { describe, expect, test } from "vite-plus/test";

import { formatWeekdayHeader, formatWeekdayName, isEmptyNotesJson } from "@/lib/timetable/utils";

describe("formatWeekdayName", () => {
  test("returns the English weekday name for en-US", () => {
    expect(formatWeekdayName("Monday", "en-US")).toBe("Monday");
    expect(formatWeekdayName("Sunday", "en-US")).toBe("Sunday");
  });

  test("localizes weekday names", () => {
    expect(formatWeekdayName("Monday", "ja")).toBe("月曜日");
    expect(formatWeekdayName("Friday", "fr")).toBe("vendredi");
  });

  test("returns the original value for unknown day names", () => {
    expect(formatWeekdayName("NotADay", "ja")).toBe("NotADay");
  });
});

describe("formatWeekdayHeader", () => {
  // 24 Aug 2026 is a Monday.
  const weekStart = new Date(2026, 7, 24);

  test("English has no day marker", () => {
    expect(formatWeekdayHeader("Monday", weekStart, "en-US")).toBe("Monday 24");
  });

  test("Japanese uses 日", () => {
    expect(formatWeekdayHeader("Monday", weekStart, "ja")).toBe("月曜日 24日");
  });

  test("Korean uses 일", () => {
    expect(formatWeekdayHeader("Monday", weekStart, "ko")).toBe("월요일 24일");
  });

  test("Simplified Chinese uses 号", () => {
    expect(formatWeekdayHeader("Monday", weekStart, "zh-Hans")).toBe("星期一 24号");
  });

  test("Traditional Chinese uses 日", () => {
    expect(formatWeekdayHeader("Monday", weekStart, "zh-Hant")).toBe("星期一 24日");
  });
});

describe("isEmptyNotesJson", () => {
  test("treats missing, blank, and empty docs as empty", () => {
    expect(isEmptyNotesJson(undefined)).toBe(true);
    expect(isEmptyNotesJson("")).toBe(true);
    expect(
      isEmptyNotesJson(JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] })),
    ).toBe(true);
  });

  test("treats docs with text as not empty", () => {
    expect(
      isEmptyNotesJson(
        JSON.stringify({
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
        }),
      ),
    ).toBe(false);
  });
});
