import { describe, expect, test } from "vite-plus/test";

import {
  normalizeGradeScaleLevels,
  resolveGradeLabel,
} from "../../../convex/lib/gradeScales/normalize.js";
import { SYSTEM_GRADE_SCALE_SEEDS } from "../../../convex/lib/gradeScales/defaults.js";

describe("normalizeGradeScaleLevels", () => {
  test("accepts standard scale bands", () => {
    const seed = SYSTEM_GRADE_SCALE_SEEDS.find((entry) => entry.systemKey === "standard");
    expect(seed).toBeDefined();
    const levels = normalizeGradeScaleLevels(seed!.levels);
    expect(levels[0]?.minPercent).toBe(90);
    expect(levels[levels.length - 1]?.minPercent).toBe(0);
  });

  test("rejects gaps between bands", () => {
    expect(() =>
      normalizeGradeScaleLevels([
        { label: "A", minPercent: 90, maxPercent: 100 },
        { label: "B", minPercent: 70, maxPercent: 85 },
        { label: "F", minPercent: 0, maxPercent: 69 },
      ]),
    ).toThrow(/connect without gaps/);
  });

  test("rejects highest grade that does not reach 100%", () => {
    expect(() =>
      normalizeGradeScaleLevels([
        { label: "A", minPercent: 90, maxPercent: 99 },
        { label: "F", minPercent: 0, maxPercent: 89 },
      ]),
    ).toThrow(/highest grade must reach 100%/);
  });
});

describe("resolveGradeLabel", () => {
  const standard = SYSTEM_GRADE_SCALE_SEEDS.find((entry) => entry.systemKey === "standard")!.levels;

  test("maps integer display max inclusively via next band min", () => {
    expect(resolveGradeLabel(standard, 89)).toBe("4");
    expect(resolveGradeLabel(standard, 89.99)).toBe("4");
    expect(resolveGradeLabel(standard, 90)).toBe("5");
  });

  test("maps letter grades A through F", () => {
    const letterGrades = SYSTEM_GRADE_SCALE_SEEDS.find(
      (entry) => entry.systemKey === "letterGrades",
    )!.levels;

    expect(resolveGradeLabel(letterGrades, 95)).toBe("A");
    expect(resolveGradeLabel(letterGrades, 85)).toBe("B");
    expect(resolveGradeLabel(letterGrades, 75)).toBe("C");
    expect(resolveGradeLabel(letterGrades, 65)).toBe("D");
    expect(resolveGradeLabel(letterGrades, 55)).toBe("F");
  });
});
