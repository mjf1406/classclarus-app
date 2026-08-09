import { describe, expect, test } from "vite-plus/test";

import { formatRewardPoints } from "./rewards";

describe("formatRewardPoints", () => {
  test("accepts app language codes that are not raw BCP 47 tags", () => {
    expect(() => formatRewardPoints(1234, "engb")).not.toThrow();
    expect(formatRewardPoints(1234, "engb")).toBe(formatRewardPoints(1234, "en-GB"));
  });
});
