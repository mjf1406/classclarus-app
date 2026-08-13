import { describe, expect, it } from "vite-plus/test";

import { collectAlgorithmHistoryPages } from "./algorithmHistoryPages";

describe("collectAlgorithmHistoryPages", () => {
  it("walks every page and records the cursor used for each fetch", async () => {
    const pages = [
      { page: [1, 2], isDone: false, continueCursor: "c1" },
      { page: [3], isDone: false, continueCursor: "c2" },
      {
        page: Array.from({ length: 200 }, (_, index) => index + 4),
        isDone: true,
        continueCursor: "",
      },
    ];
    let calls = 0;
    const result = await collectAlgorithmHistoryPages(async (cursor) => {
      const page = pages[calls]!;
      calls += 1;
      if (calls === 1) expect(cursor).toBeNull();
      if (calls === 2) expect(cursor).toBe("c1");
      if (calls === 3) expect(cursor).toBe("c2");
      return page;
    });
    expect(result.cursors).toEqual([null, "c1", "c2"]);
    expect(result.rows).toHaveLength(203);
    expect(calls).toBe(3);
  });
});
