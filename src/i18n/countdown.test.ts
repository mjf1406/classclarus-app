import { describe, expect, test } from "vite-plus/test";

import { pickCountdownUnit } from "./countdown";

describe("pickCountdownUnit", () => {
  test("steps through seconds, minutes, hours, and days", () => {
    expect(pickCountdownUnit(30_000)).toEqual({ value: 30, unit: "second" });
    expect(pickCountdownUnit(45 * 60_000)).toEqual({ value: 45, unit: "minute" });
    expect(pickCountdownUnit(22 * 60 * 60_000)).toEqual({ value: 22, unit: "hour" });
    expect(pickCountdownUnit(3 * 24 * 60 * 60_000)).toEqual({ value: 3, unit: "day" });
  });

  test("returns a zero-second countdown when expired", () => {
    expect(pickCountdownUnit(-1)).toEqual({ value: 0, unit: "second" });
  });
});
