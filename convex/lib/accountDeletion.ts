import { ConvexError } from "convex/values";

import type { Id } from "../_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "../_generated/server.js";
import { authz } from "../authz.js";
import { polar } from "../polar.js";
import { deleteJoinCodeById } from "./joinCodesCleanup.js";
import { clearBannerIfReferencesFile } from "./filesCleanup.js";
import { isSelfHosted } from "./selfHosted.js";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

export type AccountDeletionBlocker = "owns_classes" | "active_subscription";

export function accountDeleteConfirmationPhrase(email: string | undefined | null): string {
  const trimmed = email?.trim();
  if (trimmed) {
    return `delete ${trimmed}`;
  }
  return "delete my account";
}

/**
 * List linked auth provider ids for a user (e.g. "google").
 * Bounded: a user has a handful of linked accounts at most.
 */
export async function listLinkedProviders(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Array<string>> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- per-user auth accounts are tiny
  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
    .collect();
  const providers = accounts.map((account) => account.provider);
  providers.sort();
  return providers;
}

export async function getAccountDeletionBlockers(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Array<AccountDeletionBlocker>> {
  const blockers: Array<AccountDeletionBlocker> = [];

  const ownedClass = await ctx.db
    .query("classes")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .first();
  if (ownedClass) {
    blockers.push("owns_classes");
  }

  if (!isSelfHosted()) {
    const subscription = await polar.getCurrentSubscription(ctx, { userId });
    if (subscription && ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
      blockers.push("active_subscription");
    }
  }

  return blockers;
}

async function deleteAuthSessionsForUser(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- per-user sessions are tiny
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();

  for (const session of sessions) {
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- refresh tokens per session are tiny
    const refreshTokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .collect();
    for (const token of refreshTokens) {
      await ctx.db.delete("authRefreshTokens", token._id);
    }
    await ctx.db.delete("authSessions", session._id);
  }
}

async function deleteAuthAccountsForUser(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- per-user auth accounts are tiny
  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
    .collect();

  for (const account of accounts) {
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- verification codes per account are tiny
    const codes = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id))
      .collect();
    for (const code of codes) {
      await ctx.db.delete("authVerificationCodes", code._id);
    }
    await ctx.db.delete("authAccounts", account._id);
  }
}

async function deleteJoinCodesCreatedByUser(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- creator-scoped invite codes are short-lived and few
  const codes = await ctx.db
    .query("joinCodes")
    .withIndex("by_creator", (q) => q.eq("createdBy", userId))
    .collect();
  for (const code of codes) {
    await deleteJoinCodeById(ctx, code._id);
  }
}

async function deleteFilesForUser(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- per-user uploads are bounded by rate limits
  const files = await ctx.db
    .query("files")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  for (const file of files) {
    await clearBannerIfReferencesFile(ctx, file._id, file.classId);
    await ctx.storage.delete(file.storageId);
    await ctx.db.delete("files", file._id);
  }
}

async function deleteUserSettings(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const settings = await ctx.db
    .query("userSettings")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (settings) {
    await ctx.db.delete("userSettings", settings._id);
  }
}

async function clearTrialGrantUserId(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const grant = await ctx.db
    .query("trialGrants")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  if (grant) {
    await ctx.db.patch("trialGrants", grant._id, { userId: undefined });
  }
}

/**
 * Hard-delete the authenticated user's account data.
 * Preserves `trialGrants` (anti-abuse) and Polar billing records (legal/tax).
 * Clears `trialGrants.userId` so the emailKey remains the durable identity.
 */
export async function deleteAccountData(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const blockers = await getAccountDeletionBlockers(ctx, userId);
  if (blockers.includes("owns_classes")) {
    throw new ConvexError({
      code: "OWNS_CLASSES",
      message: "Transfer or delete your classes before deleting your account.",
    });
  }
  if (blockers.includes("active_subscription")) {
    throw new ConvexError({
      code: "ACTIVE_SUBSCRIPTION",
      message: "Cancel your subscription and wait until it ends before deleting your account.",
    });
  }

  await deleteJoinCodesCreatedByUser(ctx, userId);
  await deleteFilesForUser(ctx, userId);
  await deleteUserSettings(ctx, userId);
  await authz.deprovisionUser(ctx, userId, { actorId: userId, enableAudit: true });
  await deleteAuthSessionsForUser(ctx, userId);
  await deleteAuthAccountsForUser(ctx, userId);
  await clearTrialGrantUserId(ctx, userId);
  await ctx.db.delete("users", userId);
}
