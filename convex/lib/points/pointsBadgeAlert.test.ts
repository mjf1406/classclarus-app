import { describe, expect, test } from "vite-plus/test";

import {
  crossedPointsBadgeAlerts,
  normalizePointsBadgeAlerts,
  pointsBadgeAlertEnglishTitle,
  pointsBadgeAlertsEqual,
  pointsBoardHref,
  resolvePointsBadgeAlerts,
} from "./pointsBadgeAlert";

describe("pointsBadgeAlert", () => {
  test("resolvePointsBadgeAlerts drops invalid rows and sorts by count", () => {
    expect(resolvePointsBadgeAlerts(undefined)).toEqual([]);
    expect(
      resolvePointsBadgeAlerts([
        { count: 5, action: "Email parents" },
        { count: 3, action: "  Write a letter\n" },
        { count: 3, action: "Duplicate ignored" },
        { count: 0, action: "Too low" },
        { count: 1.5, action: "Not an integer" },
        { count: 7, action: "" },
      ]),
    ).toEqual([
      { count: 3, action: "Write a letter" },
      { count: 5, action: "Email parents" },
    ]);
  });

  test("normalizePointsBadgeAlerts validates mutation input", () => {
    expect(
      normalizePointsBadgeAlerts([
        { count: 5, action: "Email parents" },
        { count: 3, action: "Write a letter" },
      ]),
    ).toEqual([
      { count: 3, action: "Write a letter" },
      { count: 5, action: "Email parents" },
    ]);
    expect(() => normalizePointsBadgeAlerts([{ count: 0, action: "Call" }])).toThrow(/at least/);
    expect(() => normalizePointsBadgeAlerts([{ count: 3, action: "  " }])).toThrow(/required/);
    expect(() =>
      normalizePointsBadgeAlerts([
        { count: 3, action: "Write a letter" },
        { count: 3, action: "Email parents" },
      ]),
    ).toThrow(/unique/);
  });

  test("crossedPointsBadgeAlerts fires for counts newly reached", () => {
    const alerts = [
      { count: 3, action: "Write a letter" },
      { count: 5, action: "Email parents" },
      { count: 7, action: "Call parents" },
    ];
    expect(crossedPointsBadgeAlerts(2, 3, alerts)).toEqual([
      { count: 3, action: "Write a letter" },
    ]);
    expect(crossedPointsBadgeAlerts(3, 4, alerts)).toEqual([]);
    expect(crossedPointsBadgeAlerts(2, 6, alerts)).toEqual([
      { count: 3, action: "Write a letter" },
      { count: 5, action: "Email parents" },
    ]);
    expect(crossedPointsBadgeAlerts(0, 7, alerts)).toEqual(alerts);
    expect(crossedPointsBadgeAlerts(7, 6, alerts)).toEqual([]);
  });

  test("pointsBadgeAlertsEqual compares count and action", () => {
    expect(pointsBadgeAlertsEqual([], [])).toBe(true);
    expect(
      pointsBadgeAlertsEqual(
        [{ count: 3, action: "Write a letter" }],
        [{ count: 3, action: "Write a letter" }],
      ),
    ).toBe(true);
    expect(
      pointsBadgeAlertsEqual(
        [{ count: 3, action: "Write a letter" }],
        [{ count: 3, action: "Email parents" }],
      ),
    ).toBe(false);
  });

  test("builds English title and points board href", () => {
    expect(pointsBadgeAlertEnglishTitle("Alex Kim", "warning", 3)).toBe("Alex Kim has 3 warnings");
    expect(pointsBadgeAlertEnglishTitle("Alex Kim", "minus", 2)).toBe("Alex Kim has 2 minus marks");
    expect(pointsBoardHref("class_abc")).toBe("/class/class_abc/points");
  });
});
