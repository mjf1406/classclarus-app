import type { FunctionReturnType } from "convex/server";

import { api } from "../../../convex/_generated/api";
import type { PurchaseLimit } from "@/lib/rewards/purchaseLimit";

export const MAX_REWARD_NAME_LENGTH = 100;
export const MAX_REWARD_DESCRIPTION_LENGTH = 500;
export const MAX_REWARD_POINTS = 1_000_000;

export type RewardListItem = FunctionReturnType<typeof api.rewards.list>[number];
export type RewardList = FunctionReturnType<typeof api.rewards.list>;
export type RewardFolderListItem = FunctionReturnType<typeof api.rewardFolders.list>[number];
export type RewardFolderList = FunctionReturnType<typeof api.rewardFolders.list>;

export type PointsApplyMode = "future" | "retroactive";

export type RewardFormValues = {
  name: string;
  description?: string;
  icon?: string;
  points: number;
  folderId?: RewardListItem["folderId"];
  purchaseLimit?: PurchaseLimit;
  pointsApplyMode?: PointsApplyMode;
};

export function formatRewardPoints(points: number, language: string): string {
  return new Intl.NumberFormat(language).format(points);
}

export function filterRewardsByName(rewards: RewardList, query: string): RewardList {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return rewards;
  return rewards.filter((reward) => reward.name.toLowerCase().includes(trimmed));
}

export function partitionRewardsByFolder(
  rewards: RewardList,
  folderId: RewardFolderListItem["_id"] | null,
): RewardList {
  if (folderId === null) {
    return rewards.filter((reward) => reward.folderId === undefined);
  }
  return rewards.filter((reward) => reward.folderId === folderId);
}
