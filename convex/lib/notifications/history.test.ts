import { describe, expect, test } from "vite-plus/test";

import {
  buildSearchText,
  contentFromNotification,
  decodeHistoryCursor,
  encodeHistoryCursor,
  historyFieldsUnchanged,
  historyListContinuation,
  isHistoryRowAfterCursor,
  matchesHistoryFilters,
  paginateHistoryRows,
  pushPayloadFromNotification,
  statusKeyFromState,
} from "./history";
import type { Doc, Id } from "../../_generated/dataModel.js";

describe("notification history mapping", () => {
  test("derives status keys from seen and dismissed flags", () => {
    expect(statusKeyFromState(false, false)).toBe("unread");
    expect(statusKeyFromState(true, false)).toBe("read");
    expect(statusKeyFromState(false, true)).toBe("dismissed");
    expect(statusKeyFromState(true, true)).toBe("dismissed");
  });

  test("builds searchable title and description text", () => {
    expect(buildSearchText("Quiz", "Bring pencils")).toBe("Quiz Bring pencils");
    expect(buildSearchText("  Quiz  ", "  ")).toBe("Quiz");
    expect(buildSearchText("", undefined)).toBe("");
  });

  test("maps calendar reminder payloads and unknown kinds", () => {
    expect(
      contentFromNotification("calendar_reminder", {
        summaryKey: "calendarReminder",
        title: "Assembly",
        description: "Gym",
        classId: "class_1",
        className: "Homeroom",
        eventId: "event_1",
        href: "/class/class_1/calendar/event/event_1",
      }),
    ).toEqual({
      title: "Assembly",
      description: "Gym",
      classId: "class_1",
      className: "Homeroom",
      eventId: "event_1",
      href: "/class/class_1/calendar/event/event_1",
    });

    expect(contentFromNotification("future_kind", { title: "Hello" })).toEqual({
      title: "Hello",
      href: "/",
    });
    expect(contentFromNotification("future_kind", null)).toEqual({
      title: "future_kind",
      href: "/",
    });
  });

  test("builds Web Push payload for calendar reminders only", () => {
    expect(
      pushPayloadFromNotification("calendar_reminder", {
        title: "Assembly",
        description: "Gym",
        classId: "class_1",
        className: "Homeroom",
        eventId: "event_1",
        href: "/class/class_1/calendar/event/event_1",
      }),
    ).toEqual({
      title: "Assembly",
      body: "Gym",
      url: "/class/class_1/calendar/event/event_1",
    });
    expect(
      pushPayloadFromNotification("calendar_reminder", {
        title: "Assembly",
        classId: "class_1",
        className: "Homeroom",
        eventId: "event_1",
        href: "/class/class_1/calendar/event/event_1",
      }),
    ).toEqual({
      title: "Assembly",
      body: "Homeroom",
      url: "/class/class_1/calendar/event/event_1",
    });
    expect(pushPayloadFromNotification("future_kind", { title: "Hello" })).toBeNull();
  });
});

describe("notification history filters and cursors", () => {
  test("encodes and decodes createdAt plus notificationId cursors", () => {
    const encoded = encodeHistoryCursor({ createdAt: 100, notificationId: "abc:def" });
    expect(decodeHistoryCursor(encoded)).toEqual({ createdAt: 100, notificationId: "abc:def" });
    expect(decodeHistoryCursor("bad")).toBeNull();
  });

  test("walks newest-first with notificationId tie-break", () => {
    const cursor = { createdAt: 200, notificationId: "n2" };
    expect(isHistoryRowAfterCursor({ createdAt: 100, notificationId: "n1" }, cursor)).toBe(true);
    expect(isHistoryRowAfterCursor({ createdAt: 200, notificationId: "n1" }, cursor)).toBe(true);
    expect(isHistoryRowAfterCursor({ createdAt: 200, notificationId: "n2" }, cursor)).toBe(false);
    expect(isHistoryRowAfterCursor({ createdAt: 300, notificationId: "n3" }, cursor)).toBe(false);
  });

  test("matches status, kind, class, date, and text filters including dismissed rows", () => {
    const dismissed = {
      kind: "calendar_reminder",
      statusKey: "dismissed" as const,
      classId: "class_1",
      createdAt: 1_000,
      searchText: "Assembly Gym",
    };
    expect(
      matchesHistoryFilters(dismissed, {
        searchQuery: "gym",
        status: "dismissed",
        kind: "calendar_reminder",
        classId: "class_1",
        createdAfterMs: 500,
      }),
    ).toBe(true);
    expect(
      matchesHistoryFilters(dismissed, {
        searchQuery: "assembly",
        status: "unread",
      }),
    ).toBe(false);
    expect(
      matchesHistoryFilters(dismissed, {
        searchQuery: "",
        status: "all",
        createdAfterMs: 2_000,
      }),
    ).toBe(false);
  });

  test("paginates filtered rows newest-first", () => {
    const rows = [
      { createdAt: 1, notificationId: "a", title: "old" },
      { createdAt: 3, notificationId: "c", title: "new" },
      { createdAt: 2, notificationId: "b", title: "mid" },
    ];
    const first = paginateHistoryRows(rows, 2, null);
    expect(first.items.map((row) => row.notificationId)).toEqual(["c", "b"]);
    expect(first.isDone).toBe(false);
    const second = paginateHistoryRows(rows, 2, decodeHistoryCursor(first.continueCursor ?? ""));
    expect(second.items.map((row) => row.notificationId)).toEqual(["a"]);
    expect(second.isDone).toBe(true);
  });

  test("continues when a scan fills but the filtered page does not", () => {
    const short = historyListContinuation({
      collectedCount: 3,
      limit: 20,
      scannedAll: false,
      lastItem: { createdAt: 50, notificationId: "n3" },
      lastScanned: { createdAt: 10, notificationId: "n80" },
    });
    expect(short.isDone).toBe(false);
    expect(short.continueCursor).toBe(
      encodeHistoryCursor({ createdAt: 10, notificationId: "n80" }),
    );
  });

  test("continues from the last returned item when the page is full", () => {
    const full = historyListContinuation({
      collectedCount: 20,
      limit: 20,
      scannedAll: false,
      lastItem: { createdAt: 50, notificationId: "n20" },
      lastScanned: { createdAt: 10, notificationId: "n80" },
    });
    expect(full.isDone).toBe(false);
    expect(full.continueCursor).toBe(encodeHistoryCursor({ createdAt: 50, notificationId: "n20" }));
  });

  test("finishes when a full page lands on the last scanned row", () => {
    const done = historyListContinuation({
      collectedCount: 20,
      limit: 20,
      scannedAll: true,
      lastItem: { createdAt: 1, notificationId: "n20" },
      lastScanned: { createdAt: 1, notificationId: "n20" },
    });
    expect(done).toEqual({ isDone: true });
  });
});

describe("notification history upsert skip", () => {
  test("skips unchanged projection rows", () => {
    const existing = {
      sequence: 1,
      kind: "calendar_reminder",
      statusKey: "unread",
      title: "Assembly",
      searchText: "Assembly",
      href: "/c",
      isSeen: false,
      isDismissed: false,
      createdAt: 10,
    } as Doc<"notificationHistory">;

    expect(
      historyFieldsUnchanged(existing, {
        userId: "user_1" as Id<"users">,
        notificationId: "n1",
        sequence: 1,
        kind: "calendar_reminder",
        title: "Assembly",
        href: "/c",
        isSeen: false,
        isDismissed: false,
        createdAt: 10,
      }),
    ).toBe(true);

    expect(
      historyFieldsUnchanged(existing, {
        userId: "user_1" as Id<"users">,
        notificationId: "n1",
        sequence: 1,
        kind: "calendar_reminder",
        title: "Assembly renamed",
        href: "/c",
        isSeen: false,
        isDismissed: false,
        createdAt: 10,
      }),
    ).toBe(false);
  });
});
