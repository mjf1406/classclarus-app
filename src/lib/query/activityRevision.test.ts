import { describe, expect, test } from "vite-plus/test";

import { activityRevisionsEqual } from "./activityRevision";

describe("activityRevisionsEqual", () => {
  test("treats null revisions as equal", () => {
    expect(activityRevisionsEqual(null, null)).toBe(true);
  });

  test("detects identity and timestamp changes", () => {
    expect(
      activityRevisionsEqual({ eventId: "a", createdAt: 1 }, { eventId: "a", createdAt: 1 }),
    ).toBe(true);
    expect(
      activityRevisionsEqual({ eventId: "a", createdAt: 1 }, { eventId: "b", createdAt: 1 }),
    ).toBe(false);
    expect(
      activityRevisionsEqual({ eventId: "a", createdAt: 1 }, { eventId: "a", createdAt: 2 }),
    ).toBe(false);
    expect(activityRevisionsEqual({ eventId: "a", createdAt: 1 }, null)).toBe(false);
  });
});
