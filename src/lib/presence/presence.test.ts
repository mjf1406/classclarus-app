import { describe, expect, test } from "vite-plus/test";

import {
  mergePresenceDisplaySummaries,
  normalizeOnlineUserIds,
  PRESENCE_LIST_LIMIT,
} from "@/lib/presence/presence";
import type { PresenceState } from "@/hooks/presence/useClassPresence";

function presenceEntry(userId: string, online = true): PresenceState {
  return { userId, online, lastDisconnected: 0 };
}

describe("normalizeOnlineUserIds", () => {
  test("returns empty for undefined or empty input", () => {
    expect(normalizeOnlineUserIds(undefined)).toEqual([]);
    expect(normalizeOnlineUserIds(new Set())).toEqual([]);
    expect(normalizeOnlineUserIds([])).toEqual([]);
  });

  test("deduplicates, sorts, and caps at the presence list limit", () => {
    const ids = ["user-c", "user-a", "user-b", "user-a"];
    expect(normalizeOnlineUserIds(ids)).toEqual(["user-a", "user-b", "user-c"]);
    expect(normalizeOnlineUserIds(new Set(ids))).toEqual(["user-a", "user-b", "user-c"]);

    const overLimit = Array.from({ length: PRESENCE_LIST_LIMIT + 5 }, (_, index) =>
      String(index).padStart(3, "0"),
    );
    const normalized = normalizeOnlineUserIds(overLimit);
    expect(normalized).toHaveLength(PRESENCE_LIST_LIMIT);
    expect(normalized[0]).toBe("000");
    expect(normalized.at(-1)).toBe(String(PRESENCE_LIST_LIMIT - 1).padStart(3, "0"));
  });
});

describe("mergePresenceDisplaySummaries", () => {
  test("passes through undefined and empty summaries", () => {
    expect(mergePresenceDisplaySummaries(undefined, [{ userId: "a", name: "A" }])).toBeUndefined();
    expect(mergePresenceDisplaySummaries([], undefined)).toEqual([]);
    expect(mergePresenceDisplaySummaries([presenceEntry("a")], [])).toEqual([presenceEntry("a")]);
  });

  test("merges name and image for matching users only", () => {
    const state = [
      presenceEntry("online-a"),
      presenceEntry("online-b", false),
      presenceEntry("online-c"),
    ];
    const merged = mergePresenceDisplaySummaries(state, [
      { userId: "online-a", name: "Alice", image: "https://example.com/a.png" },
      { userId: "missing-user", name: "Ghost" },
    ]);

    expect(merged).toEqual([
      {
        userId: "online-a",
        online: true,
        lastDisconnected: 0,
        name: "Alice",
        image: "https://example.com/a.png",
      },
      { userId: "online-b", online: false, lastDisconnected: 0 },
      { userId: "online-c", online: true, lastDisconnected: 0 },
    ]);
  });
});
