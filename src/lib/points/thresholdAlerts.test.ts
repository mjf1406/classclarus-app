import { describe, expect, test } from "vite-plus/test";

import { highestCrossedAlert, studentsAtThresholds } from "./thresholdAlerts";

describe("highestCrossedAlert", () => {
  test("returns null when no alerts are configured", () => {
    expect(highestCrossedAlert(5, [])).toBeNull();
  });

  test("returns null when the count is below every alert", () => {
    expect(
      highestCrossedAlert(2, [
        { count: 3, action: "Talk" },
        { count: 5, action: "Call home" },
      ]),
    ).toBeNull();
  });

  test("returns the highest alert the count has reached", () => {
    expect(
      highestCrossedAlert(5, [
        { count: 3, action: "Talk" },
        { count: 5, action: "Call home" },
        { count: 7, action: "Office" },
      ]),
    ).toEqual({ count: 5, action: "Call home" });
  });
});

describe("studentsAtThresholds", () => {
  test("returns an empty list when no alerts are configured", () => {
    expect(
      studentsAtThresholds([{ userId: "s1", warningCount: 4, minusCount: 2 }], [], []),
    ).toEqual([]);
  });

  test("includes only students who reached a configured alert", () => {
    const hits = studentsAtThresholds(
      [
        { userId: "s1", warningCount: 5, minusCount: 0 },
        { userId: "s2", warningCount: 1, minusCount: 0 },
        { userId: "s3", warningCount: 0, minusCount: 7 },
      ],
      [{ count: 3, action: "Talk" }],
      [{ count: 5, action: "Remove" }],
    );

    expect(hits.map((hit) => hit.userId)).toEqual(["s3", "s1"]);
    expect(hits[0]).toMatchObject({
      metric: "minus",
      count: 7,
      threshold: 5,
      action: "Remove",
    });
    expect(hits[1]).toMatchObject({
      metric: "warning",
      count: 5,
      threshold: 3,
      action: "Talk",
    });
  });

  test("emits both warning and minus hits for the same student", () => {
    const hits = studentsAtThresholds(
      [{ userId: "s1", warningCount: 3, minusCount: 5 }],
      [{ count: 3, action: "Talk" }],
      [{ count: 5, action: "Remove" }],
    );

    expect(hits).toHaveLength(2);
    expect(hits.map((hit) => hit.metric)).toEqual(["minus", "warning"]);
  });
});
