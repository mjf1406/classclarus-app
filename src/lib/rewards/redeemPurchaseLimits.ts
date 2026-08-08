import type { Id } from "../../../convex/_generated/dataModel";
import type { PurchaseLimitPeriod } from "@/lib/rewards/purchaseLimit";

export type RewardPurchaseLimitStatus = {
  studentUserId: Id<"users">;
  rewardId: Id<"rewards">;
  usedInWindow: number;
  kind: "item" | "folder";
  maxPurchases: number;
  period: PurchaseLimitPeriod;
  every: number;
  folderId?: Id<"rewardFolders">;
};

export type RedeemLimitBlockReason = {
  kind: "item" | "folder";
  maxPurchases: number;
  period: PurchaseLimitPeriod;
  every: number;
};

/**
 * Whether adding `quantity` of `rewardId` would exceed any selected student's limit,
 * given other currently selected reward ids (same shared quantity).
 */
export function redeemPurchaseLimitBlock(
  rewardId: Id<"rewards">,
  quantity: number,
  selectedRewardIds: ReadonlySet<string>,
  studentUserIds: ReadonlyArray<Id<"users">>,
  statuses: ReadonlyArray<RewardPurchaseLimitStatus>,
): RedeemLimitBlockReason | null {
  if (quantity < 1 || studentUserIds.length === 0) return null;

  for (const studentUserId of studentUserIds) {
    const status = statuses.find(
      (entry) => entry.studentUserId === studentUserId && entry.rewardId === rewardId,
    );
    if (!status) continue;

    let committed = 0;
    if (status.kind === "item") {
      if (selectedRewardIds.has(rewardId)) committed = quantity;
    } else {
      for (const entry of statuses) {
        if (entry.studentUserId !== studentUserId) continue;
        if (entry.kind !== "folder") continue;
        if (entry.folderId !== status.folderId) continue;
        if (selectedRewardIds.has(entry.rewardId)) committed += quantity;
      }
    }

    const wouldUse =
      status.usedInWindow + committed + (selectedRewardIds.has(rewardId) ? 0 : quantity);
    if (wouldUse > status.maxPurchases) {
      return {
        kind: status.kind,
        maxPurchases: status.maxPurchases,
        period: status.period,
        every: status.every,
      };
    }
  }

  return null;
}
