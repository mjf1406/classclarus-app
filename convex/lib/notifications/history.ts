import type { Doc, Id } from "../../_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "../../_generated/server.js";

export const NOTIFICATION_HISTORY_STATUSES = ["unread", "read", "dismissed"] as const;
export type NotificationHistoryStatus = (typeof NOTIFICATION_HISTORY_STATUSES)[number];

export const NOTIFICATION_HISTORY_KINDS = ["calendar_reminder"] as const;
export type NotificationHistoryKind = (typeof NOTIFICATION_HISTORY_KINDS)[number];

export const HISTORY_PAGE_SIZE = 20;
export const HISTORY_PAGE_SIZE_MAX = 50;
export const HISTORY_SCAN_LIMIT = 200;
export const HISTORY_SEARCH_SCAN_LIMIT = 1024;

export type HistoryCursor = {
  createdAt: number;
  notificationId: string;
};

export type HistoryContent = {
  title: string;
  description?: string;
  classId?: string;
  className?: string;
  eventId?: string;
  href: string;
};

export type HistoryMappedFields = HistoryContent & {
  userId: Id<"users">;
  notificationId: string;
  sequence: number;
  kind: string;
  isSeen: boolean;
  isDismissed: boolean;
  seenAt?: number;
  dismissedAt?: number;
  createdAt: number;
  updatedAt?: number;
};

export type HistoryListFilters = {
  searchQuery: string;
  status: NotificationHistoryStatus | "all";
  kind?: string;
  classId?: string;
  createdAfterMs?: number;
};

export type HistoryListItem = {
  _id: Id<"notificationHistory">;
  notificationId: string;
  sequence: number;
  kind: string;
  statusKey: NotificationHistoryStatus;
  title: string;
  description?: string;
  classId?: string;
  className?: string;
  eventId?: string;
  href: string;
  isSeen: boolean;
  isDismissed: boolean;
  seenAt?: number;
  dismissedAt?: number;
  createdAt: number;
};

type CalendarReminderData = {
  title: string;
  description?: string;
  classId: string;
  className: string;
  eventId: string;
  href: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function isCalendarReminderData(value: unknown): value is CalendarReminderData {
  if (!isRecord(value)) return false;
  return (
    typeof value.title === "string" &&
    typeof value.classId === "string" &&
    typeof value.className === "string" &&
    typeof value.eventId === "string" &&
    typeof value.href === "string" &&
    (value.description === undefined || typeof value.description === "string")
  );
}

export function statusKeyFromState(
  isSeen: boolean,
  isDismissed: boolean,
): NotificationHistoryStatus {
  if (isDismissed) return "dismissed";
  if (isSeen) return "read";
  return "unread";
}

export function buildSearchText(title: string, description?: string): string {
  return [title, description]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function contentFromNotification(kind: string, data: unknown): HistoryContent {
  if (kind === "calendar_reminder" && isCalendarReminderData(data)) {
    return {
      title: data.title,
      ...(data.description ? { description: data.description } : {}),
      classId: data.classId,
      className: data.className,
      eventId: data.eventId,
      href: data.href,
    };
  }

  if (isRecord(data)) {
    const title = asOptionalString(data.title) ?? kind;
    const description = asOptionalString(data.description);
    const href = asOptionalString(data.href) ?? "/";
    const classId = asOptionalString(data.classId);
    const className = asOptionalString(data.className);
    const eventId = asOptionalString(data.eventId);
    return {
      title,
      ...(description ? { description } : {}),
      ...(classId ? { classId } : {}),
      ...(className ? { className } : {}),
      ...(eventId ? { eventId } : {}),
      href,
    };
  }

  return { title: kind, href: "/" };
}

export function encodeHistoryCursor(cursor: HistoryCursor): string {
  return `${cursor.createdAt}:${cursor.notificationId}`;
}

export function decodeHistoryCursor(value: string | undefined): HistoryCursor | null {
  if (!value) return null;
  const separator = value.indexOf(":");
  if (separator <= 0) return null;
  const createdAt = Number(value.slice(0, separator));
  const notificationId = value.slice(separator + 1);
  if (!Number.isFinite(createdAt) || notificationId.length === 0) return null;
  return { createdAt, notificationId };
}

/** Newest-first: later pages are older createdAt, then smaller notificationId. */
export function isHistoryRowAfterCursor(
  row: { createdAt: number; notificationId: string },
  cursor: HistoryCursor,
): boolean {
  if (row.createdAt < cursor.createdAt) return true;
  if (row.createdAt > cursor.createdAt) return false;
  return row.notificationId < cursor.notificationId;
}

export function matchesHistoryFilters(
  row: {
    kind: string;
    statusKey: NotificationHistoryStatus;
    classId?: string;
    createdAt: number;
    searchText: string;
  },
  filters: HistoryListFilters,
): boolean {
  if (filters.status !== "all" && row.statusKey !== filters.status) return false;
  if (filters.kind && row.kind !== filters.kind) return false;
  if (filters.classId && row.classId !== filters.classId) return false;
  if (filters.createdAfterMs !== undefined && row.createdAt < filters.createdAfterMs) return false;
  const query = filters.searchQuery.trim().toLowerCase();
  if (query.length > 0 && !row.searchText.toLowerCase().includes(query)) return false;
  return true;
}

export function paginateHistoryRows<T extends { createdAt: number; notificationId: string }>(
  rows: readonly T[],
  limit: number,
  cursor: HistoryCursor | null,
): { items: T[]; continueCursor: string | undefined; isDone: boolean } {
  const sorted = [...rows].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
    return a.notificationId < b.notificationId ? 1 : a.notificationId > b.notificationId ? -1 : 0;
  });
  const afterCursor = cursor
    ? sorted.filter((row) => isHistoryRowAfterCursor(row, cursor))
    : sorted;
  const items = afterCursor.slice(0, limit);
  const last = items[items.length - 1];
  const isDone = afterCursor.length <= limit;
  return {
    items,
    continueCursor:
      !isDone && last
        ? encodeHistoryCursor({ createdAt: last.createdAt, notificationId: last.notificationId })
        : undefined,
    isDone,
  };
}

/** Decide whether another page exists after a bounded index scan. */
export function historyListContinuation(args: {
  collectedCount: number;
  limit: number;
  scannedAll: boolean;
  lastItem?: HistoryCursor;
  lastScanned?: HistoryCursor;
}): { continueCursor?: string; isDone: boolean } {
  const filledPage = args.collectedCount >= args.limit;
  if (filledPage && args.lastItem) {
    const lastIsScanEnd =
      args.scannedAll &&
      args.lastScanned !== undefined &&
      args.lastItem.createdAt === args.lastScanned.createdAt &&
      args.lastItem.notificationId === args.lastScanned.notificationId;
    if (lastIsScanEnd) return { isDone: true };
    return {
      continueCursor: encodeHistoryCursor(args.lastItem),
      isDone: false,
    };
  }
  if (!args.scannedAll && args.lastScanned) {
    return {
      continueCursor: encodeHistoryCursor(args.lastScanned),
      isDone: false,
    };
  }
  return { isDone: true };
}

export function toPublicHistoryItem(row: Doc<"notificationHistory">): HistoryListItem {
  return {
    _id: row._id,
    notificationId: row.notificationId,
    sequence: row.sequence,
    kind: row.kind,
    statusKey: row.statusKey,
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    ...(row.classId ? { classId: row.classId } : {}),
    ...(row.className ? { className: row.className } : {}),
    ...(row.eventId ? { eventId: row.eventId } : {}),
    href: row.href,
    isSeen: row.isSeen,
    isDismissed: row.isDismissed,
    ...(row.seenAt !== undefined ? { seenAt: row.seenAt } : {}),
    ...(row.dismissedAt !== undefined ? { dismissedAt: row.dismissedAt } : {}),
    createdAt: row.createdAt,
  };
}

function historyDocumentFields(mapped: HistoryMappedFields) {
  const statusKey = statusKeyFromState(mapped.isSeen, mapped.isDismissed);
  const searchText = buildSearchText(mapped.title, mapped.description);
  return {
    userId: mapped.userId,
    notificationId: mapped.notificationId,
    sequence: mapped.sequence,
    kind: mapped.kind,
    statusKey,
    title: mapped.title,
    ...(mapped.description ? { description: mapped.description } : {}),
    searchText: searchText.length > 0 ? searchText : mapped.kind,
    ...(mapped.classId ? { classId: mapped.classId } : {}),
    ...(mapped.className ? { className: mapped.className } : {}),
    ...(mapped.eventId ? { eventId: mapped.eventId } : {}),
    href: mapped.href,
    isSeen: mapped.isSeen,
    isDismissed: mapped.isDismissed,
    ...(mapped.seenAt !== undefined ? { seenAt: mapped.seenAt } : {}),
    ...(mapped.dismissedAt !== undefined ? { dismissedAt: mapped.dismissedAt } : {}),
    createdAt: mapped.createdAt,
    ...(mapped.updatedAt !== undefined ? { updatedAt: mapped.updatedAt } : {}),
  };
}

export function historyFieldsUnchanged(
  existing: Doc<"notificationHistory">,
  mapped: HistoryMappedFields,
): boolean {
  const next = historyDocumentFields(mapped);
  return (
    existing.sequence === next.sequence &&
    existing.kind === next.kind &&
    existing.statusKey === next.statusKey &&
    existing.title === next.title &&
    existing.description === next.description &&
    existing.searchText === next.searchText &&
    existing.classId === next.classId &&
    existing.className === next.className &&
    existing.eventId === next.eventId &&
    existing.href === next.href &&
    existing.isSeen === next.isSeen &&
    existing.isDismissed === next.isDismissed &&
    existing.seenAt === next.seenAt &&
    existing.dismissedAt === next.dismissedAt &&
    existing.createdAt === next.createdAt
  );
}

async function findHistoryByNotification(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  notificationId: string,
): Promise<Doc<"notificationHistory"> | null> {
  return await ctx.db
    .query("notificationHistory")
    .withIndex("by_userId_notificationId", (q) =>
      q.eq("userId", userId).eq("notificationId", notificationId),
    )
    .unique();
}

export async function upsertHistoryFromMapped(
  ctx: MutationCtx,
  mapped: HistoryMappedFields,
): Promise<"inserted" | "patched" | "skipped"> {
  const existing = await findHistoryByNotification(ctx, mapped.userId, mapped.notificationId);
  const fields = historyDocumentFields(mapped);
  if (!existing) {
    await ctx.db.insert("notificationHistory", fields);
    return "inserted";
  }
  if (historyFieldsUnchanged(existing, mapped)) {
    return "skipped";
  }
  await ctx.db.patch("notificationHistory", existing._id, fields);
  return "patched";
}

export async function upsertHistoryFromCreated(
  ctx: MutationCtx,
  args: {
    notificationId: string;
    targetId: string;
    kind: string;
    data: unknown;
    createdAt: number;
    sequence?: number;
  },
): Promise<void> {
  const content = contentFromNotification(args.kind, args.data);
  await upsertHistoryFromMapped(ctx, {
    userId: args.targetId as Id<"users">,
    notificationId: args.notificationId,
    sequence: args.sequence ?? args.createdAt,
    kind: args.kind,
    isSeen: false,
    isDismissed: false,
    createdAt: args.createdAt,
    ...content,
  });
}

export async function upsertHistoryFromComponentItem(
  ctx: MutationCtx,
  userId: Id<"users">,
  item: {
    _id: string;
    sequence: number;
    kind: string;
    data: unknown;
    isSeen: boolean;
    isDismissed: boolean;
    seenAt?: number;
    dismissedAt?: number;
    createdAt: number;
    updatedAt?: number;
  },
): Promise<"inserted" | "patched" | "skipped"> {
  const content = contentFromNotification(item.kind, item.data);
  return await upsertHistoryFromMapped(ctx, {
    userId,
    notificationId: item._id,
    sequence: item.sequence,
    kind: item.kind,
    isSeen: item.isSeen,
    isDismissed: item.isDismissed,
    ...(item.seenAt !== undefined ? { seenAt: item.seenAt } : {}),
    ...(item.dismissedAt !== undefined ? { dismissedAt: item.dismissedAt } : {}),
    createdAt: item.createdAt,
    ...(item.updatedAt !== undefined ? { updatedAt: item.updatedAt } : {}),
    ...content,
  });
}

export async function markHistorySeen(
  ctx: MutationCtx,
  userId: Id<"users">,
  notificationId: string,
  now: number,
): Promise<void> {
  const existing = await findHistoryByNotification(ctx, userId, notificationId);
  if (!existing || existing.isSeen) return;
  await ctx.db.patch("notificationHistory", existing._id, {
    isSeen: true,
    seenAt: now,
    statusKey: statusKeyFromState(true, existing.isDismissed),
    updatedAt: now,
  });
}

export async function markAllHistorySeen(
  ctx: MutationCtx,
  userId: Id<"users">,
  now: number,
): Promise<number> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- per-user unread history is bounded
  const unread = await ctx.db
    .query("notificationHistory")
    .withIndex("by_userId_statusKey_createdAt", (q) =>
      q.eq("userId", userId).eq("statusKey", "unread"),
    )
    .collect();
  for (const row of unread) {
    await ctx.db.patch("notificationHistory", row._id, {
      isSeen: true,
      seenAt: row.seenAt ?? now,
      statusKey: statusKeyFromState(true, row.isDismissed),
      updatedAt: now,
    });
  }
  return unread.length;
}

export async function markHistoryDismissed(
  ctx: MutationCtx,
  userId: Id<"users">,
  notificationId: string,
  now: number,
): Promise<void> {
  const existing = await findHistoryByNotification(ctx, userId, notificationId);
  if (!existing || existing.isDismissed) return;
  await ctx.db.patch("notificationHistory", existing._id, {
    isDismissed: true,
    isSeen: true,
    dismissedAt: now,
    seenAt: existing.seenAt ?? now,
    statusKey: "dismissed",
    updatedAt: now,
  });
}

export async function markAllHistoryDismissed(
  ctx: MutationCtx,
  userId: Id<"users">,
  now: number,
): Promise<number> {
  let touched = 0;
  for (const statusKey of ["unread", "read"] as const) {
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- per-user active history is bounded
    const rows = await ctx.db
      .query("notificationHistory")
      .withIndex("by_userId_statusKey_createdAt", (q) =>
        q.eq("userId", userId).eq("statusKey", statusKey),
      )
      .collect();
    for (const row of rows) {
      await ctx.db.patch("notificationHistory", row._id, {
        isDismissed: true,
        isSeen: true,
        dismissedAt: now,
        seenAt: row.seenAt ?? now,
        statusKey: "dismissed",
        updatedAt: now,
      });
      touched += 1;
    }
  }
  return touched;
}

export async function markHistoryDismissedByEventId(
  ctx: MutationCtx,
  eventId: string,
  now: number,
): Promise<number> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- event-bounded reminder fan-out
  const rows = await ctx.db
    .query("notificationHistory")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .collect();
  let touched = 0;
  for (const row of rows) {
    if (row.isDismissed) continue;
    await ctx.db.patch("notificationHistory", row._id, {
      isDismissed: true,
      isSeen: true,
      dismissedAt: now,
      seenAt: row.seenAt ?? now,
      statusKey: "dismissed",
      updatedAt: now,
    });
    touched += 1;
  }
  return touched;
}

function clampPageSize(limit: number | undefined): number {
  if (limit === undefined) return HISTORY_PAGE_SIZE;
  return Math.max(1, Math.min(Math.floor(limit), HISTORY_PAGE_SIZE_MAX));
}

export async function listHistoryForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  args: HistoryListFilters & { cursor?: string; limit?: number },
): Promise<{
  page: HistoryListItem[];
  continueCursor?: string;
  isDone: boolean;
}> {
  const limit = clampPageSize(args.limit);
  const cursor = decodeHistoryCursor(args.cursor);
  const searchQuery = args.searchQuery.trim();

  if (searchQuery.length > 0) {
    const searched = await ctx.db
      .query("notificationHistory")
      .withSearchIndex("search_text", (q) => {
        let query = q.search("searchText", searchQuery).eq("userId", userId);
        if (args.kind) query = query.eq("kind", args.kind);
        if (args.classId) query = query.eq("classId", args.classId);
        if (args.status !== "all") query = query.eq("statusKey", args.status);
        return query;
      })
      .take(HISTORY_SEARCH_SCAN_LIMIT);

    const matched = searched.filter((row) =>
      matchesHistoryFilters(row, { ...args, searchQuery: "" }),
    );
    const paged = paginateHistoryRows(
      matched.map((row) => ({ ...row, notificationId: row.notificationId })),
      limit,
      cursor,
    );
    return {
      page: paged.items.map(toPublicHistoryItem),
      ...(paged.continueCursor ? { continueCursor: paged.continueCursor } : {}),
      isDone: paged.isDone,
    };
  }

  const scanSize = Math.min(HISTORY_SCAN_LIMIT, Math.max(limit * 4, 80));
  const collected: Array<Doc<"notificationHistory">> = [];
  let scanCursor = cursor;
  let scannedAll = false;
  let lastScanned: HistoryCursor | undefined;

  for (let pass = 0; pass < 8 && collected.length < limit; pass += 1) {
    const rows = await fetchHistoryScan(ctx, userId, args, scanCursor, scanSize);
    scannedAll = rows.length < scanSize;
    const lastRow = rows[rows.length - 1];
    if (lastRow) {
      lastScanned = {
        createdAt: lastRow.createdAt,
        notificationId: lastRow.notificationId,
      };
    }
    for (const row of rows) {
      if (scanCursor && !isHistoryRowAfterCursor(row, scanCursor)) continue;
      if (!matchesHistoryFilters(row, args)) continue;
      collected.push(row);
      if (collected.length >= limit) break;
    }
    if (
      scanCursor &&
      lastScanned &&
      lastScanned.createdAt === scanCursor.createdAt &&
      lastScanned.notificationId === scanCursor.notificationId
    ) {
      scannedAll = true;
      break;
    }
    if (scannedAll || !lastScanned) break;
    scanCursor = lastScanned;
  }

  const lastItem = collected[collected.length - 1];
  const continuation = historyListContinuation({
    collectedCount: collected.length,
    limit,
    scannedAll,
    ...(lastItem
      ? {
          lastItem: {
            createdAt: lastItem.createdAt,
            notificationId: lastItem.notificationId,
          },
        }
      : {}),
    ...(lastScanned ? { lastScanned } : {}),
  });
  return {
    page: collected.map(toPublicHistoryItem),
    ...(continuation.continueCursor ? { continueCursor: continuation.continueCursor } : {}),
    isDone: continuation.isDone,
  };
}

async function fetchHistoryScan(
  ctx: QueryCtx,
  userId: Id<"users">,
  args: HistoryListFilters,
  cursor: HistoryCursor | null,
  scanSize: number,
): Promise<Array<Doc<"notificationHistory">>> {
  const statusKey = args.status;
  if (statusKey === "all") {
    return await ctx.db
      .query("notificationHistory")
      .withIndex("by_userId_createdAt", (q) => {
        const base = q.eq("userId", userId);
        if (args.createdAfterMs !== undefined) {
          return cursor
            ? base.gte("createdAt", args.createdAfterMs).lte("createdAt", cursor.createdAt)
            : base.gte("createdAt", args.createdAfterMs);
        }
        return cursor ? base.lte("createdAt", cursor.createdAt) : base;
      })
      .order("desc")
      .take(scanSize);
  }
  return await ctx.db
    .query("notificationHistory")
    .withIndex("by_userId_statusKey_createdAt", (q) => {
      const base = q.eq("userId", userId).eq("statusKey", statusKey);
      if (args.createdAfterMs !== undefined) {
        return cursor
          ? base.gte("createdAt", args.createdAfterMs).lte("createdAt", cursor.createdAt)
          : base.gte("createdAt", args.createdAfterMs);
      }
      return cursor ? base.lte("createdAt", cursor.createdAt) : base;
    })
    .order("desc")
    .take(scanSize);
}
