import { describe, expect, test } from "vite-plus/test";

import {
  applySlotDisableChange,
  compareIsoWeeks,
  listIsoWeeksForWeekdayInRange,
  selectWeeksForScope,
  weekIsInScope,
  type IsoWeek,
} from "./slotDisableScope";

const week = (year: number, weekNumber: number): IsoWeek => ({ year, weekNumber });

describe("listIsoWeeksForWeekdayInRange", () => {
  test("lists Mondays inside a January range", () => {
    expect(listIsoWeeksForWeekdayInRange("2026-01-05", "2026-01-26", "Monday")).toEqual([
      week(2026, 2),
      week(2026, 3),
      week(2026, 4),
      week(2026, 5),
    ]);
  });

  test("crosses the ISO year boundary", () => {
    expect(listIsoWeeksForWeekdayInRange("2025-12-22", "2026-01-12", "Monday")).toEqual([
      week(2025, 52),
      week(2026, 1),
      week(2026, 2),
      week(2026, 3),
    ]);
  });
});

describe("selectWeeksForScope", () => {
  const termWeeks = [week(2025, 52), week(2026, 1), week(2026, 2), week(2026, 3)];

  test("this week is only the selected week", () => {
    expect(selectWeeksForScope(termWeeks, week(2026, 1), "thisWeek")).toEqual([week(2026, 1)]);
  });

  test("from week includes the selected week and later term weeks", () => {
    expect(selectWeeksForScope(termWeeks, week(2026, 1), "fromWeek")).toEqual([
      week(2026, 1),
      week(2026, 2),
      week(2026, 3),
    ]);
  });

  test("all weeks returns the term weeks", () => {
    expect(selectWeeksForScope(termWeeks, week(2026, 1), "allWeeks")).toEqual(termWeeks);
  });
});

describe("weekIsInScope", () => {
  test("compares ISO weeks across years", () => {
    expect(compareIsoWeeks(week(2025, 52), week(2026, 1))).toBeLessThan(0);
    expect(weekIsInScope(week(2025, 52), week(2026, 1), "fromWeek")).toBe(false);
    expect(weekIsInScope(week(2026, 2), week(2026, 1), "fromWeek")).toBe(true);
    expect(weekIsInScope(week(2026, 1), week(2026, 1), "thisWeek")).toBe(true);
    expect(weekIsInScope(week(2026, 2), week(2026, 1), "thisWeek")).toBe(false);
    expect(weekIsInScope(week(2025, 52), week(2026, 1), "allWeeks")).toBe(true);
  });
});

describe("applySlotDisableChange", () => {
  const termWeeks = [week(2026, 2), week(2026, 3), week(2026, 4), week(2026, 5)];

  test("disabling all weeks sets the global flag and clears week rows", () => {
    expect(
      applySlotDisableChange(
        { globallyDisabled: false, disabledWeeks: [week(2026, 3)] },
        termWeeks,
        week(2026, 3),
        "allWeeks",
        true,
      ),
    ).toEqual({ globallyDisabled: true, disabledWeeks: [] });
  });

  test("disabling from the selected week unions week rows", () => {
    expect(
      applySlotDisableChange(
        { globallyDisabled: false, disabledWeeks: [week(2026, 2)] },
        termWeeks,
        week(2026, 4),
        "fromWeek",
        true,
      ),
    ).toEqual({
      globallyDisabled: false,
      disabledWeeks: [week(2026, 2), week(2026, 4), week(2026, 5)],
    });
  });

  test("disabling a later scope does not hide a global disable", () => {
    const global = { globallyDisabled: true, disabledWeeks: [] as Array<IsoWeek> };
    expect(applySlotDisableChange(global, termWeeks, week(2026, 4), "fromWeek", true)).toEqual(
      global,
    );
  });

  test("enabling this week converts a global disable into remaining week rows", () => {
    expect(
      applySlotDisableChange(
        { globallyDisabled: true, disabledWeeks: [] },
        termWeeks,
        week(2026, 3),
        "thisWeek",
        false,
      ),
    ).toEqual({
      globallyDisabled: false,
      disabledWeeks: [week(2026, 2), week(2026, 4), week(2026, 5)],
    });
  });

  test("enabling from the selected week leaves earlier weeks disabled", () => {
    expect(
      applySlotDisableChange(
        { globallyDisabled: true, disabledWeeks: [] },
        termWeeks,
        week(2026, 4),
        "fromWeek",
        false,
      ),
    ).toEqual({
      globallyDisabled: false,
      disabledWeeks: [week(2026, 2), week(2026, 3)],
    });
  });

  test("enabling all weeks clears global and week disables", () => {
    expect(
      applySlotDisableChange(
        { globallyDisabled: true, disabledWeeks: [week(2026, 2)] },
        termWeeks,
        week(2026, 3),
        "allWeeks",
        false,
      ),
    ).toEqual({ globallyDisabled: false, disabledWeeks: [] });
  });
});
