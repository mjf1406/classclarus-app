import { describe, expect, test } from "vite-plus/test";

import { ACTIVITY_RECENT_PAGE_SIZE, mergeActivityRecentWithPages } from "./activityPagination";

function event(id: string) {
  return { _id: id };
}

describe("mergeActivityRecentWithPages", () => {
  test("returns cached pages when recent is empty", () => {
    const result = mergeActivityRecentWithPages([], [[event("a")], [event("b")]]);
    expect(result.items.map((row) => row._id)).toEqual(["a", "b"]);
    expect(result.hasOverlapGap).toBe(false);
  });

  test("returns recent when cache is empty", () => {
    const result = mergeActivityRecentWithPages([event("n1"), event("n2")], []);
    expect(result.items.map((row) => row._id)).toEqual(["n1", "n2"]);
    expect(result.hasOverlapGap).toBe(false);
  });

  test("deduplicates recent over cached pages and keeps newest-first recent head", () => {
    const result = mergeActivityRecentWithPages(
      [event("n1"), event("a")],
      [[event("a"), event("b")], [event("c")]],
    );
    expect(result.items.map((row) => row._id)).toEqual(["n1", "a", "b", "c"]);
    expect(result.hasOverlapGap).toBe(false);
  });

  test("flags gap when a full recent page has no overlap with cached head", () => {
    const recent = Array.from({ length: ACTIVITY_RECENT_PAGE_SIZE }, (_, index) =>
      event(`new-${index}`),
    );
    const result = mergeActivityRecentWithPages(recent, [[event("old-1"), event("old-2")]]);
    expect(result.hasOverlapGap).toBe(true);
    expect(result.items[0]?._id).toBe("new-0");
    expect(result.items.at(-1)?._id).toBe("old-2");
  });

  test("does not flag gap for a partial recent page without overlap", () => {
    const result = mergeActivityRecentWithPages([event("only-new")], [[event("old")]]);
    expect(result.hasOverlapGap).toBe(false);
  });
});
