import { describe, expect, test } from "vitest";

import { normalizeEndTime, secondsUntilEndTime } from "./timerUtils.js";

describe("normalizeEndTime", () => {
  test("adds seconds to HH:mm", () => {
    expect(normalizeEndTime("14:30")).toBe("14:30:00");
  });

  test("keeps HH:mm:ss", () => {
    expect(normalizeEndTime("14:30:15")).toBe("14:30:15");
  });
});

describe("secondsUntilEndTime", () => {
  const sydneyAfternoon = Date.parse("2026-09-01T05:00:00.000Z");

  test("computes seconds until 16:00 in Australia/Sydney", () => {
    expect(secondsUntilEndTime("16:00:00", "Australia/Sydney", sydneyAfternoon)).toBe(3600);
  });

  test("interprets the same wall clock in UTC as a later instant", () => {
    expect(secondsUntilEndTime("16:00:00", "UTC", sydneyAfternoon)).toBe(11 * 3600);
  });

  test("includes seconds in the target wall clock", () => {
    expect(secondsUntilEndTime("16:00:30", "Australia/Sydney", sydneyAfternoon)).toBe(3630);
  });

  test("rolls to the next calendar day in the class timezone", () => {
    const afterEnd = Date.parse("2026-09-01T06:30:00.000Z");
    expect(secondsUntilEndTime("16:00:00", "Australia/Sydney", afterEnd)).toBe(23.5 * 3600);
  });

  test("rolls to the next UTC day when the end time has passed", () => {
    const noonUtc = Date.parse("2026-01-15T12:00:00.000Z");
    expect(secondsUntilEndTime("11:00:00", "UTC", noonUtc)).toBe(23 * 3600);
  });
});
