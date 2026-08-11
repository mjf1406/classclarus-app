import { describe, expect, test } from "vite-plus/test";

import {
  createClientGradedSubjectFormSchema,
  equalSplitWeightPercents,
  formatWeightPercent,
  pointsSplitWeightPercents,
  weightPercentDisplayDecimals,
  weightPercentTotal,
  weightsAreValid,
} from "@/lib/gradedSubjects/gradedSubjects";
import { assignWeightSliceVisuals } from "@/lib/gradedSubjects/weightSliceVisuals";

describe("gradedSubjects weights", () => {
  test("equalSplitWeightPercents sums to 100", () => {
    for (const count of [1, 2, 3, 5, 7]) {
      const percents = equalSplitWeightPercents(count);
      expect(percents).toHaveLength(count);
      expect(weightPercentTotal(percents.map((weightPercent) => ({ weightPercent })))).toBe(100);
    }
  });

  test("pointsSplitWeightPercents is proportional and sums to 100", () => {
    expect(pointsSplitWeightPercents([50, 50])).toEqual([50, 50]);
    expect(pointsSplitWeightPercents([25, 75])).toEqual([25, 75]);
    expect(pointsSplitWeightPercents([10, 20, 70])).toEqual([10, 20, 70]);

    const uneven = pointsSplitWeightPercents([1, 1, 1]);
    expect(uneven).toHaveLength(3);
    expect(weightPercentTotal(uneven.map((weightPercent) => ({ weightPercent })))).toBe(100);
    expect(uneven[0]).toBe(33.33);
    expect(uneven[1]).toBe(33.33);
    expect(uneven[2]).toBe(33.34);
  });

  test("pointsSplitWeightPercents rejects empty or non-positive points", () => {
    expect(pointsSplitWeightPercents([])).toEqual([]);
    expect(pointsSplitWeightPercents([10, 0])).toEqual([]);
    expect(pointsSplitWeightPercents([-5, 10])).toEqual([]);
  });

  test("weightsAreValid requires total 100 and at least one item", () => {
    expect(weightsAreValid([])).toBe(false);
    expect(weightsAreValid([{ weightPercent: 50 }, { weightPercent: 50 }])).toBe(true);
    expect(weightsAreValid([{ weightPercent: 40 }, { weightPercent: 50 }])).toBe(false);
  });

  test("weightPercentDisplayDecimals picks the max needed across values", () => {
    expect(weightPercentDisplayDecimals([50, 50])).toBe(0);
    expect(weightPercentDisplayDecimals([33.5, 66.5])).toBe(1);
    expect(weightPercentDisplayDecimals([50, 33.5])).toBe(1);
    expect(weightPercentDisplayDecimals([33.33, 33.33, 33.34])).toBe(2);
    expect(weightPercentDisplayDecimals([50, 25.5, 24.5])).toBe(1);
    expect(weightPercentDisplayDecimals([50, 25.55, 24.45])).toBe(2);
  });

  test("formatWeightPercent uses only necessary decimals (max 2)", () => {
    expect(formatWeightPercent(50)).toBe("50");
    expect(formatWeightPercent(33.5)).toBe("33.5");
    expect(formatWeightPercent(16.666666)).toBe("16.67");
    expect(formatWeightPercent(0.3)).toBe("0.3");
    expect(formatWeightPercent(50, 2)).toBe("50.00");
    expect(formatWeightPercent(33.5, 2)).toBe("33.50");
  });
});

describe("createClientGradedSubjectFormSchema", () => {
  const t = (key: string) => key;
  const schema = createClientGradedSubjectFormSchema(t);

  test("accepts a valid percent-based form", () => {
    const result = schema.safeParse({
      name: "Math",
      icon: "",
      gradeScaleId: "scale1",
      items: [{ assignmentId: "a1", weightPercent: 100 }],
    });
    expect(result.success).toBe(true);
  });

  test("rejects weights that do not sum to 100", () => {
    const result = schema.safeParse({
      name: "Math",
      icon: "",
      gradeScaleId: "scale1",
      items: [
        { assignmentId: "a1", weightPercent: 40 },
        { assignmentId: "a2", weightPercent: 40 },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("weightSliceVisuals", () => {
  test("assignWeightSliceVisuals is stable for the same keys", () => {
    const keys = ["a:1", "b:2", "c:"];
    const first = assignWeightSliceVisuals(keys);
    const second = assignWeightSliceVisuals(keys);
    for (const key of keys) {
      expect(first.get(key)?.iconId).toBe(second.get(key)?.iconId);
      expect(first.get(key)?.color).toBe(second.get(key)?.color);
    }
  });

  test("assignWeightSliceVisuals uses unique animals when count is within pool", () => {
    const keys = ["k1", "k2", "k3", "k4", "k5"];
    const visuals = assignWeightSliceVisuals(keys);
    const iconIds = keys.map((key) => visuals.get(key)?.iconId);
    expect(new Set(iconIds).size).toBe(keys.length);
  });

  test("assignWeightSliceVisuals keeps color by display index", () => {
    const keys = ["x:", "y:"];
    const visuals = assignWeightSliceVisuals(keys);
    expect(visuals.get("x:")?.color).toBe("var(--chart-1)");
    expect(visuals.get("y:")?.color).toBe("var(--chart-2)");
  });
});
