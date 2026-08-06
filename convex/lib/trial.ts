import { APP_CONFIG } from "../appConfig.js";
import { internal } from "../_generated/api.js";
import type { Id } from "../_generated/dataModel.js";
import type { MutationCtx } from "../_generated/server.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Normalize an email for trial-grant identity.
 * Applies Unicode NFKC, lowercases, and trims. Rejects (returns null) when the
 * local part contains non-ASCII after NFKC or the address is malformed.
 * Dot and `+tag` stripping apply only to gmail.com / googlemail.com.
 */
export function normalizeEmail(email: string): string | null {
  const trimmed = email.normalize("NFKC").trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) {
    return null;
  }
  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);

  if (!local || !domain || !domain.includes(".")) {
    return null;
  }
  if (hasNonAscii(local) || hasNonAscii(domain)) {
    return null;
  }

  if (domain === "gmail.com" || domain === "googlemail.com") {
    const plus = local.indexOf("+");
    if (plus >= 0) {
      local = local.slice(0, plus);
    }
    local = local.replaceAll(".", "");
    if (!local) {
      return null;
    }
    return `${local}@gmail.com`;
  }

  return `${local}@${domain}`;
}

function hasNonAscii(value: string): boolean {
  for (const char of value) {
    if (char.charCodeAt(0) > 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Schedule (or re-schedule) the trial expiry flip for a grant.
 * Cancels any previous job first.
 */
export async function scheduleTrialExpiry(
  ctx: MutationCtx,
  grantId: Id<"trialGrants">,
  endsAt: number,
  previousJobId?: Id<"_scheduled_functions">,
): Promise<Id<"_scheduled_functions">> {
  if (previousJobId !== undefined) {
    try {
      await ctx.scheduler.cancel(previousJobId);
    } catch {
      // Job may already have run or been cancelled.
    }
  }
  return await ctx.scheduler.runAt(endsAt, internal.trial.markExpired, { grantId });
}

/**
 * Claim (or re-attach) the one-time trial grant for this email.
 * Existing grants keep their original `endsAt` — never reset.
 * Never steals a grant owned by a live user; never creates a second grant for a user.
 */
export async function claimTrialGrant(
  ctx: MutationCtx,
  userId: Id<"users">,
  email: string,
): Promise<void> {
  const own = await ctx.db
    .query("trialGrants")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  if (own) {
    return;
  }

  const emailKey = normalizeEmail(email);
  if (!emailKey) {
    return;
  }

  const existing = await ctx.db
    .query("trialGrants")
    .withIndex("by_emailKey", (q) => q.eq("emailKey", emailKey))
    .unique();

  if (existing) {
    // Reattach only when the grant was cleared on account deletion.
    if (existing.userId === undefined) {
      await ctx.db.patch("trialGrants", existing._id, { userId });
    }
    return;
  }

  const now = Date.now();
  const endsAt = now + APP_CONFIG.trial.days * MS_PER_DAY;
  const grantId = await ctx.db.insert("trialGrants", {
    emailKey,
    userId,
    startedAt: now,
    endsAt,
  });
  const expirationJobId = await scheduleTrialExpiry(ctx, grantId, endsAt);
  await ctx.db.patch("trialGrants", grantId, { expirationJobId });
}
