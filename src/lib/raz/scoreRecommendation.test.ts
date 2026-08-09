import { describe, expect, test } from "vite-plus/test";

import { getScoreRecommendation } from "@/lib/raz/scoreRecommendation";

describe("getScoreRecommendation", () => {
  test("recommends level up at 95%+ accuracy and perfect respond", () => {
    const rec = getScoreRecommendation(100, 5, "E");
    expect(rec.result).toBe("level_up");
    expect(rec.level).toBe("F");
    expect(rec.actionKey).toBe("recommendActionLevelUp");
  });

  test("recommends stay at 95%+ accuracy and 80%+ respond", () => {
    const rec = getScoreRecommendation(96, 4, "E");
    expect(rec.result).toBe("stay");
    expect(rec.level).toBe("E");
  });

  test("recommends level down below 90% accuracy", () => {
    const rec = getScoreRecommendation(89, 5, "E");
    expect(rec.result).toBe("level_down");
    expect(rec.level).toBe("D");
  });

  test("keeps aa lowercase when leveling", () => {
    const rec = getScoreRecommendation(100, 5, "aa");
    expect(rec.result).toBe("level_up");
    expect(rec.level).toBe("A");
  });
});
