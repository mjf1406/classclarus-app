import { describe, expect, it } from "vite-plus/test";

import { DURATION_PRESETS, TIME_ADJUST_PRESETS } from "@/lib/classroomScreen/durationPresets";

describe("DURATION_PRESETS", () => {
  it("keeps the classroom-screen quick start durations", () => {
    expect(DURATION_PRESETS.map((preset) => preset.seconds)).toEqual([
      10, 30, 60, 300, 600, 900, 1200, 1500, 1800,
    ]);
  });

  it("keeps the navbar time-adjust amounts", () => {
    expect(TIME_ADJUST_PRESETS.map((preset) => preset.seconds)).toEqual([1, 10, 30, 60, 300]);
  });
});
