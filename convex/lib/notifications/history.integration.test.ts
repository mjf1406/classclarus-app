import { describe, expect, it } from "vite-plus/test";

import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { createConvexTest } from "../../test.setup";
import {
  listHistoryForUser,
  markAllHistorySeen,
  markHistoryDismissed,
  markHistoryDismissedByEventId,
  markHistorySeen,
  upsertHistoryFromComponentItem,
} from "./history";

type HistorySeed = {
  notificationId: string;
  title: string;
  description?: string;
  statusKey: "unread" | "read" | "dismissed";
  classId?: string;
  className?: string;
  eventId?: string;
  createdAt: number;
};

async function insertHistory(
  ctx: MutationCtx,
  userId: Id<"users">,
  seed: HistorySeed,
): Promise<void> {
  const isDismissed = seed.statusKey === "dismissed";
  const isSeen = seed.statusKey !== "unread";
  const searchText = [seed.title, seed.description].filter(Boolean).join(" ");
  await ctx.db.insert("notificationHistory", {
    userId,
    notificationId: seed.notificationId,
    sequence: seed.createdAt,
    kind: "calendar_reminder",
    statusKey: seed.statusKey,
    title: seed.title,
    ...(seed.description ? { description: seed.description } : {}),
    searchText,
    ...(seed.classId ? { classId: seed.classId } : {}),
    ...(seed.className ? { className: seed.className } : {}),
    ...(seed.eventId ? { eventId: seed.eventId } : {}),
    href: "/calendar",
    isSeen,
    isDismissed,
    createdAt: seed.createdAt,
  });
}

describe("notification history query and sync", () => {
  it("lists a user's history with search, dismissed rows, and filters", async () => {
    const test = createConvexTest();
    const result = await test.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        name: "Pat",
        email: "pat@example.com",
      });
      const otherId = await ctx.db.insert("users", {
        name: "Other",
        email: "other@example.com",
      });

      await insertHistory(ctx, userId, {
        notificationId: "n-unread",
        title: "Assembly",
        description: "Gym doors",
        statusKey: "unread",
        classId: "class_1",
        className: "Homeroom",
        eventId: "event_1",
        createdAt: 3_000,
      });
      await insertHistory(ctx, userId, {
        notificationId: "n-dismissed",
        title: "Quiz",
        description: "Bring pencils",
        statusKey: "dismissed",
        classId: "class_2",
        className: "Science",
        eventId: "event_2",
        createdAt: 2_000,
      });
      await insertHistory(ctx, userId, {
        notificationId: "n-old",
        title: "Old meeting",
        statusKey: "read",
        classId: "class_1",
        createdAt: 100,
      });
      await insertHistory(ctx, otherId, {
        notificationId: "n-other",
        title: "Assembly",
        description: "Other gym",
        statusKey: "unread",
        createdAt: 4_000,
      });

      const all = await listHistoryForUser(ctx, userId, {
        searchQuery: "",
        status: "all",
      });
      const dismissed = await listHistoryForUser(ctx, userId, {
        searchQuery: "",
        status: "dismissed",
      });
      const byClass = await listHistoryForUser(ctx, userId, {
        searchQuery: "",
        status: "all",
        classId: "class_1",
      });
      const recent = await listHistoryForUser(ctx, userId, {
        searchQuery: "",
        status: "all",
        createdAfterMs: 1_000,
      });
      const searched = await listHistoryForUser(ctx, userId, {
        searchQuery: "pencils",
        status: "all",
      });
      const searchedDismissed = await listHistoryForUser(ctx, userId, {
        searchQuery: "quiz",
        status: "dismissed",
      });

      return {
        allIds: all.page.map((row) => row.notificationId),
        dismissedIds: dismissed.page.map((row) => row.notificationId),
        classIds: byClass.page.map((row) => row.notificationId),
        recentIds: recent.page.map((row) => row.notificationId),
        searchedIds: searched.page.map((row) => row.notificationId),
        searchedDismissedIds: searchedDismissed.page.map((row) => row.notificationId),
      };
    });

    expect(result.allIds).toEqual(["n-unread", "n-dismissed", "n-old"]);
    expect(result.dismissedIds).toEqual(["n-dismissed"]);
    expect(result.classIds).toEqual(["n-unread", "n-old"]);
    expect(result.recentIds).toEqual(["n-unread", "n-dismissed"]);
    expect(result.searchedIds).toEqual(["n-dismissed"]);
    expect(result.searchedDismissedIds).toEqual(["n-dismissed"]);
  });

  it("synchronizes seen and dismissed projection state", async () => {
    const test = createConvexTest();
    const result = await test.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        name: "Pat",
        email: "pat@example.com",
      });
      await insertHistory(ctx, userId, {
        notificationId: "n1",
        title: "One",
        statusKey: "unread",
        eventId: "event_1",
        createdAt: 2,
      });
      await insertHistory(ctx, userId, {
        notificationId: "n2",
        title: "Two",
        statusKey: "unread",
        eventId: "event_2",
        createdAt: 1,
      });

      await markHistorySeen(ctx, userId, "n1", 10);
      const afterSeen = await listHistoryForUser(ctx, userId, {
        searchQuery: "",
        status: "read",
      });

      await markAllHistorySeen(ctx, userId, 11);
      const unreadAfterAll = await listHistoryForUser(ctx, userId, {
        searchQuery: "",
        status: "unread",
      });

      await markHistoryDismissed(ctx, userId, "n1", 12);
      const dismissed = await listHistoryForUser(ctx, userId, {
        searchQuery: "",
        status: "dismissed",
      });

      const byEvent = await markHistoryDismissedByEventId(ctx, "event_2", 13);
      const remainingActive = await listHistoryForUser(ctx, userId, {
        searchQuery: "",
        status: "read",
      });

      return {
        afterSeen: afterSeen.page.map((row) => row.notificationId),
        unreadAfterAll: unreadAfterAll.page.map((row) => row.notificationId),
        dismissed: dismissed.page.map((row) => row.notificationId),
        byEvent,
        remainingActive: remainingActive.page.map((row) => row.notificationId),
      };
    });

    expect(result.afterSeen).toEqual(["n1"]);
    expect(result.unreadAfterAll).toEqual([]);
    expect(result.dismissed).toEqual(["n1"]);
    expect(result.byEvent).toBe(1);
    expect(result.remainingActive).toEqual([]);
  });

  it("upserts component inbox rows idempotently for backfill", async () => {
    const test = createConvexTest();
    const result = await test.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        name: "Pat",
        email: "pat@example.com",
      });
      const item = {
        _id: "comp-1",
        sequence: 5,
        kind: "calendar_reminder",
        data: {
          title: "Assembly",
          classId: "class_1",
          className: "Homeroom",
          eventId: "event_1",
          href: "/c",
        },
        isSeen: false,
        isDismissed: false,
        createdAt: 100,
      };
      const first = await upsertHistoryFromComponentItem(ctx, userId, item);
      const second = await upsertHistoryFromComponentItem(ctx, userId, item);
      const third = await upsertHistoryFromComponentItem(ctx, userId, {
        ...item,
        isSeen: true,
        seenAt: 200,
      });
      return { first, second, third };
    });

    expect(result).toEqual({
      first: "inserted",
      second: "skipped",
      third: "patched",
    });
  });
});
